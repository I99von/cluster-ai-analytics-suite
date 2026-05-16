import * as ss from "simple-statistics";
import { Matrix } from "ml-matrix";
import { kmeans } from "ml-kmeans";

export type ScalerType = "StandardScaler" | "MinMaxScaler" | "RobustScaler";

export const getCorrelationMatrix = (data: number[][], columns: string[]) => {
  const matrix: any[] = [];
  const columnData = columns.map((_, i) => data.map(row => row[i]));
  const stds = columnData.map(col => ss.standardDeviation(col));

  for (let i = 0; i < columns.length; i++) {
    for (let j = 0; j < columns.length; j++) {
      // Avoid correlation if variance is zero for either column
      if (stds[i] === 0 || stds[j] === 0) {
        matrix.push({ x: columns[i], y: columns[j], value: 0 });
        continue;
      }

      try {
        const corr = ss.sampleCorrelation(columnData[i], columnData[j]);
        matrix.push({
          x: columns[i],
          y: columns[j],
          value: isNaN(corr) ? 0 : parseFloat(corr.toFixed(3))
        });
      } catch (e) {
        matrix.push({ x: columns[i], y: columns[j], value: 0 });
      }
    }
  }
  return matrix;
};

export const scaleData = (data: number[][], type: ScalerType) => {
  const matrix = new Matrix(data);
  const rows = matrix.rows;
  const cols = matrix.columns;

  const result = Array.from({ length: rows }, () => new Array(cols));

  for (let c = 0; c < cols; c++) {
    const column = matrix.getColumn(c);
    
    if (type === "MinMaxScaler") {
      const min = Math.min(...column);
      const max = Math.max(...column);
      const range = max - min || 1;
      for (let r = 0; r < rows; r++) {
        result[r][c] = (column[r] - min) / range;
      }
    } else if (type === "StandardScaler") {
      const mean = ss.mean(column);
      const std = ss.standardDeviation(column) || 1;
      for (let r = 0; r < rows; r++) {
        result[r][c] = (column[r] - mean) / std;
      }
    } else if (type === "RobustScaler") {
      const q1 = ss.quantile(column, 0.25);
      const q3 = ss.quantile(column, 0.75);
      const median = ss.median(column);
      const iqr = q3 - q1 || 1;
      for (let r = 0; r < rows; r++) {
        result[r][c] = (column[r] - median) / iqr;
      }
    }
  }
  return result as number[][];
};

export const calculateElbow = (data: number[][], maxK: number = 10) => {
  const wcss = [];
  for (let k = 1; k <= maxK; k++) {
    const result = kmeans(data, k, { initialization: "kmeans++" });
    // WCSS simplified calculation
    let error = 0;
    result.clusters.forEach((clusterIdx, rowIdx) => {
      const centroid = result.centroids[clusterIdx];
      const row = data[rowIdx];
      error += row.reduce((sum, val, idx) => sum + Math.pow(val - centroid[idx], 2), 0);
    });
    wcss.push({ k, error });
  }
  return wcss;
};

export const runClustering = (data: number[][], k: number) => {
  const result = kmeans(data, k, { initialization: "kmeans++" });
  return {
    clusters: result.clusters,
    centroids: result.centroids,
    iterations: result.iterations
  };
};

export const getDescriptiveStats = (data: any[], columns: string[]) => {
  const stats: any = {};
  columns.forEach((col, idx) => {
    const values = data.map(row => parseFloat(row[col])).filter(v => !isNaN(v));
    if (values.length > 0) {
      const uniqueValues = new Set(values).size;
      stats[col] = {
        mean: ss.mean(values).toFixed(2),
        median: ss.median(values).toFixed(2),
        min: ss.min(values).toFixed(2),
        max: ss.max(values).toFixed(2),
        std: ss.standardDeviation(values).toFixed(2),
        count: values.length,
        unique: uniqueValues,
        isContinuous: uniqueValues > 5 // Simple heuristic to exclude indicators/dichotomous
      };
    }
  });
  return stats;
};
