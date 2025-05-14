/**
 * Utility functions for handling PDF files
 */

import { format } from "date-fns";
import { it } from "date-fns/locale";

/**
 * Downloads a PDF file from a base64 encoded string
 * @param filename The name of the file to download
 * @param base64Data The base64 encoded PDF data
 */
export function downloadPdf(filename: string, base64Data: string): void {
  // Create a link element
  const link = document.createElement("a");
  
  // Verifica se il dato base64 contiene già il prefisso
  const dataUrl = base64Data.startsWith('data:application/pdf;base64,') 
    ? base64Data 
    : `data:application/pdf;base64,${base64Data}`;
  
  // Set the href attribute to a data URL that represents the PDF file
  link.href = dataUrl;
  
  // Set the download attribute to specify the filename
  link.download = filename;
  
  // Append the link to the document body (required for Firefox)
  document.body.appendChild(link);
  
  // Programmatically click the link to trigger the download
  link.click();
  
  // Remove the link from the document
  document.body.removeChild(link);
}

/**
 * Generates a filename for a schedule PDF export
 * @param startDate The start date of the schedule
 * @param endDate The end date of the schedule
 * @returns A formatted filename for the PDF
 */
export function generateScheduleFilename(startDate: Date, endDate: Date): string {
  const formattedStart = format(startDate, "dd-MM-yyyy", { locale: it });
  const formattedEnd = format(endDate, "dd-MM-yyyy", { locale: it });
  
  return `Turni_${formattedStart}_${formattedEnd}.pdf`;
}

/**
 * Generates a filename for a payslip PDF
 * @param period The period (month and year) of the payslip
 * @param employeeName The name of the employee
 * @returns A formatted filename for the PDF
 */
export function generatePayslipFilename(period: string, employeeName: string): string {
  // Replace spaces with underscores and remove special characters
  const sanitizedName = employeeName.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
  const sanitizedPeriod = period.replace(/\s+/g, "_");
  
  return `BustaPaga_${sanitizedPeriod}_${sanitizedName}.pdf`;
}

/**
 * Generates a filename for a tax document PDF
 * @param year The year of the tax document
 * @param employeeName The name of the employee
 * @returns A formatted filename for the PDF
 */
export function generateTaxDocFilename(year: string, employeeName: string): string {
  // Replace spaces with underscores and remove special characters
  const sanitizedName = employeeName.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
  
  return `CUD_${year}_${sanitizedName}.pdf`;
}
