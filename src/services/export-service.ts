import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Papa from "papaparse";

export const exportToCSV = (data: any[], fileName: string) => {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPNG = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, { scale: 2 });
  const link = document.createElement("a");
  link.download = `${fileName}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
};

export const generateProfessionalPDF = async (
  title: string,
  state: any,
  sections: { id: string; title: string }[],
  options: { orientation?: "p" | "l" } = { orientation: "p" },
  onProgress?: (msg: string) => void
) => {
  const pdf = new jsPDF(options.orientation, "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Header Helper
  const addHeader = (pageNum: number) => {
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text("CLUSTERFORGE ANALYTIC REPORT", margin, 10);
    pdf.text(`Page ${pageNum}`, pageWidth - 30, 10);
    pdf.setDrawColor(20, 20, 20); // brand-dark approx
    pdf.line(margin, 12, pageWidth - margin, 12);
  };

  // Footer Helper
  const addFooter = () => {
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, margin, pageHeight - 10);
    pdf.text("Powered by Clustera AI Engine", pageWidth - 60, pageHeight - 10);
  };

  // COVER PAGE
  onProgress?.("Generating Cover Page...");
  pdf.setFillColor(20, 20, 20); // brand-dark
  pdf.rect(0, 0, pageWidth, 100, "F");
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(32);
  pdf.text(title.toUpperCase(), margin, 50);
  
  pdf.setFontSize(12);
  pdf.text("EXECUTIVE ANALYSIS REPORT", margin, 65);
  
  pdf.setTextColor(20, 20, 20);
  pdf.setFontSize(14);
  pdf.text("CONTEXTO ESTRATÉGICO", margin, 120);
  pdf.line(margin, 122, 60, 122);
  
  pdf.setFontSize(10);
  const goalsSplit = pdf.splitTextToSize(state.businessGoals, contentWidth);
  pdf.text(goalsSplit, margin, 130);

  if (state.businessSummary) {
    pdf.setFontSize(14);
    pdf.text("RESUMEN DE INTELIGENCIA", margin, 180);
    pdf.line(margin, 182, 60, 182);
    pdf.setFontSize(10);
    pdf.setFont("italic");
    const summarySplit = pdf.splitTextToSize(state.businessSummary, contentWidth);
    pdf.text(summarySplit, margin, 190);
    pdf.setFont("normal");
  }

  addFooter();

  // SECTIONS PAGE BY PAGE
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    onProgress?.(`Capturing ${section.title}...`);
    
    const element = document.getElementById(section.id);
    if (!element) continue;

    // Small delay to ensure Recharts/Fonts are settled
    await new Promise(resolve => setTimeout(resolve, 800));

    pdf.addPage();
    addHeader(i + 2);
    
    pdf.setTextColor(20, 20, 20);
    pdf.setFontSize(18);
    pdf.text(section.title.toUpperCase(), margin, 25);
    pdf.setDrawColor(20, 20, 20);
    pdf.line(margin, 27, 40, 27);

    try {
      // Robust capture settings
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: "#E4E3E0", // brand-bg
        windowWidth: 1200,
        imageTimeout: 30000,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById(section.id);
          if (el) {
            el.style.opacity = "1";
            el.style.visibility = "visible";
            el.style.display = "block";
            
            // --- CRITICAL FIX: Convert all computed colors to RGBA for html2canvas compatibility ---
            const allElements = el.querySelectorAll("*");
            
            // Helper to resolve any CSS color to RGBA using a temp canvas
            const canvas = document.createElement("canvas");
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });

            const resolveColor = (color: string) => {
              if (!ctx || !color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return color;
              if (color.startsWith("rgb")) return color; // Already resolved
              
              try {
                ctx.clearRect(0, 0, 1, 1);
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, 1, 1);
                const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
                return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
              } catch (e) {
                return color;
              }
            };

            allElements.forEach((node: any) => {
              const styles = window.getComputedStyle(node);
              
              // Resolve color, backgroundColor, and borderColor if they contain modern functions
              const properties = ["color", "backgroundColor", "borderColor"];
              properties.forEach(prop => {
                const val = (styles as any)[prop];
                if (val && (val.includes("oklch") || val.includes("oklab") || val.includes("color-mix"))) {
                  node.style[prop] = resolveColor(val);
                }
              });
            });
            
            // Ensure Recharts containers are visible and sized correctly for capture
            const charts = el.querySelectorAll(".recharts-responsive-container");
            charts.forEach((c: any) => {
              c.style.width = "1000px";
              c.style.height = "500px";
              c.style.visibility = "visible";
            });
          }
        }
      });
      const imgData = canvas.toDataURL("image/png", 1.0);
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
      
      // Calculate best fit with aspect ratio preservation
      let finalImgHeight = imgHeight;
      let finalImgWidth = contentWidth;
      
      const maxContentHeight = pageHeight - 50; // Accounting for header/footer
      if (finalImgHeight > maxContentHeight) {
        finalImgHeight = maxContentHeight;
        finalImgWidth = (imgProps.width * finalImgHeight) / imgProps.height;
      }

      pdf.addImage(imgData, "PNG", margin, 35, finalImgWidth, finalImgHeight, undefined, 'FAST');
    } catch (err) {
      console.error(`CRITICAL RENDERING ERROR [${section.title}]:`, err);
      pdf.setTextColor(239, 68, 68); // Brand Red
      pdf.setFontSize(10);
      pdf.text(`REPORTING ENGINE ERROR: Failed to capture component [${section.title}].`, margin + 5, 45);
      pdf.text(`Technical detail: ${err instanceof Error ? err.message : "Internal capture timeout"}`, margin + 5, 52);
    }

    addFooter();
  }

  pdf.save(`${title.replace(/\s+/g, '_')}_Report_${Date.now()}.pdf`);
};
