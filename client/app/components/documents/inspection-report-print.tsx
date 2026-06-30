import * as React from "react"
import { format } from "date-fns"
import type { Document, InspectionReport } from "~/api/DocumentService"
import { buildInspectionReportPrefill } from "~/lib/inspection-report-utils"
import { getPanaboLogoUrl, PANABO_LOGO_PATH } from "~/lib/public-assets"

interface InspectionReportPrintProps {
    document: Document
    report: InspectionReport
}

function formatDate(value: string | null | undefined): string {
    if (!value) return "_________________________"
    try {
        return format(new Date(value), "MMMM d, yyyy").toUpperCase()
    } catch {
        return value
    }
}

function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function display(value: string | null | undefined): string {
    return value?.trim() || "_________________________"
}

function checkbox(label: string, selected: boolean): string {
    return `${selected ? "(X)" : "( )"} ${label}`
}

function buildEvaluationReportHtml(document: Document, report: InspectionReport, logoUrl: string): string {
    const prefill = buildInspectionReportPrefill(document)
    const lifeSpan = report.project_life_span ?? ""
    const significance = report.project_significance ?? ""
    const status = report.project_status_as_of_inspection ?? ""
    const infoOrder = report.information_provided_in_order ?? ""

    return `
        <div class="page">
            <div class="header-band">
                <div class="header-row">
                    <div class="logo"><img src="${logoUrl}" alt="City of Panabo" /></div>
                    <div class="header-text">
                        <div>Republic of the Philippines</div>
                        <div class="line-2">Province of Davao del Norte</div>
                        <div class="line-3">City of Panabo</div>
                        <div class="line-4">City Planning &amp; Development Office</div>
                        <div class="line-5">Telefax 084-822-6017 &nbsp; e-mail address: cpdupanabo@gmail.com</div>
                    </div>
                </div>
            </div>
            <h1 class="doc-title">Evaluation Report</h1>

            <table class="fields">
                <tr>
                    <td class="label">Locational Clearance #</td>
                    <td class="value">${escapeHtml(display(prefill.locationalClearanceNumber))}</td>
                    <td class="label">Date Received</td>
                    <td class="value">${escapeHtml(formatDate(prefill.dateReceived))}</td>
                    <td class="label">Date of Report</td>
                    <td class="value">${escapeHtml(formatDate(report.date_of_report))}</td>
                </tr>
            </table>

            <p class="section-heading">A. APPLICANT AND PROJECT DESCRIPTION</p>
            <table class="fields">
                <tr>
                    <td class="label">1. Name of Applicant (Last, First, Middle)</td>
                    <td class="value" colspan="3">${escapeHtml(display(prefill.applicantName))}</td>
                </tr>
                <tr>
                    <td class="label">2. Name of Corporation</td>
                    <td class="value" colspan="3">${escapeHtml(display(prefill.corporationName))}</td>
                </tr>
                <tr>
                    <td class="label">3. Address of Applicant</td>
                    <td class="value" colspan="3">${escapeHtml(display(prefill.applicantAddress))}</td>
                </tr>
                <tr>
                    <td class="label">4. Address of Corporation</td>
                    <td class="value" colspan="3">${escapeHtml(display(prefill.corporationAddress))}</td>
                </tr>
                <tr>
                    <td class="label">5. Project Type</td>
                    <td class="value" colspan="3">${escapeHtml(display(prefill.projectType))}</td>
                </tr>
                <tr>
                    <td class="label">6. Area (in sq.m.)</td>
                    <td class="value pre" colspan="3">${escapeHtml(display(report.area_details ?? prefill.areaDetails))}</td>
                </tr>
                <tr>
                    <td class="label">7. Location</td>
                    <td class="value pre" colspan="3">${escapeHtml(display(report.location_details ?? prefill.locationDetails))}</td>
                </tr>
            </table>

            <p class="section-heading">B. PROJECT EVALUATION</p>
            <table class="fields">
                <tr>
                    <td class="label">8. Project Life Span</td>
                    <td class="value">${checkbox("Permanent", lifeSpan === "Permanent")} &nbsp; ${checkbox("Temporary", lifeSpan === "Temporary")}</td>
                    <td class="label">9. Project Classification</td>
                    <td class="value">${escapeHtml(display(prefill.projectClassification))}</td>
                </tr>
                <tr>
                    <td class="label">10. Site Zoning Classification</td>
                    <td class="value">${escapeHtml(display(prefill.siteZoningClassification))}</td>
                    <td class="label">11. Project Significance</td>
                    <td class="value">${checkbox("Local Significance", significance === "Local Significance")} &nbsp; ${checkbox("National Significance", significance === "National Significance")}</td>
                </tr>
                <tr>
                    <td class="label">12. Right Over Land</td>
                    <td class="value" colspan="3">${escapeHtml(display(report.right_over_land))}</td>
                </tr>
                <tr>
                    <td class="label">13. Date of Inspection</td>
                    <td class="value">${escapeHtml(formatDate(report.inspection_date))}</td>
                    <td class="label">GPS Coordinate</td>
                    <td class="value">${escapeHtml(display(report.gps_coordinates))}</td>
                </tr>
                <tr>
                    <td class="label">14. Project Status as of Inspection Date</td>
                    <td class="value" colspan="3">
                        ${checkbox("Proposed", status === "Proposed")}
                        ${checkbox("Operational", status === "Operational")}
                        ${checkbox("Completed", status === "Completed")}
                        ${checkbox("Others", status === "Others")}
                        ${status && !["Proposed", "Operational", "Completed", "Others"].includes(status) ? escapeHtml(status) : ""}
                    </td>
                </tr>
                <tr>
                    <td class="label">15. Are information provided in order?</td>
                    <td class="value" colspan="3">
                        ${checkbox("Yes", infoOrder === "yes")}
                        ${checkbox("No (Specify Findings)", infoOrder === "no")}
                        ${report.information_provided_findings ? ` — ${escapeHtml(report.information_provided_findings)}` : ""}
                    </td>
                </tr>
                <tr>
                    <td class="label">16. Existing Land Uses Abutting Lot Boundaries</td>
                    <td class="value" colspan="3">
                        North: ${escapeHtml(display(report.abutting_north))} &nbsp;
                        South: ${escapeHtml(display(report.abutting_south))} &nbsp;
                        East: ${escapeHtml(display(report.abutting_east))} &nbsp;
                        West: ${escapeHtml(display(report.abutting_west))}
                    </td>
                </tr>
                <tr>
                    <td class="label">17. Legal Bases</td>
                    <td class="value" colspan="3">${escapeHtml(display(report.legal_bases))}</td>
                </tr>
                <tr>
                    <td class="label">18. Findings/Evaluation of Facts</td>
                    <td class="value pre" colspan="3">${escapeHtml(display(report.findings_evaluation))}</td>
                </tr>
            </table>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>Road Category</th>
                        <th>Standard RROW</th>
                        <th>Actual RROW</th>
                        <th>Min. Required Setback</th>
                        <th>As Per Plan</th>
                        <th>Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${escapeHtml(display(report.road_category))}</td>
                        <td>${escapeHtml(display(report.road_standard_rrow))}</td>
                        <td>${escapeHtml(display(report.road_actual_rrow))}</td>
                        <td>${escapeHtml(display(report.road_min_setback))}</td>
                        <td>${escapeHtml(display(report.road_as_per_plan))}</td>
                        <td>${escapeHtml(display(report.road_remarks))}</td>
                    </tr>
                </tbody>
            </table>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>PD1096 — Rev. Building Code</th>
                        <th>Parking Space Requirement</th>
                        <th>Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${escapeHtml(display(report.parking_building_code))}</td>
                        <td>${escapeHtml(display(report.parking_space_requirement))}</td>
                        <td>${escapeHtml(display(report.parking_remarks))}</td>
                    </tr>
                </tbody>
            </table>

            <table class="fields">
                <tr>
                    <td class="label">19. Decision Recommended — Remarks</td>
                    <td class="value pre" colspan="3">${escapeHtml(display(report.decision_recommended))}</td>
                </tr>
            </table>

            <div class="signatures">
                <div class="signature-block">
                    <div class="signature-line">${escapeHtml(display(report.inspector_signature))}</div>
                    <div class="signature-caption">Inspected by</div>
                    <div class="signature-role">${escapeHtml(display(report.inspector_designation))}</div>
                </div>
                <div class="signature-block">
                    <div class="signature-line">${escapeHtml(display(report.noted_by_signature))}</div>
                    <div class="signature-caption">Noted by</div>
                    <div class="signature-role">${escapeHtml(display(report.noted_by_designation))}</div>
                </div>
            </div>
        </div>
    `
}

const PRINT_STYLES = `
    @page { size: 8.5in 13in; margin: 0.5in 0.6in; }
    * { box-sizing: border-box; }
    body { font-family: "Times New Roman", Times, serif; margin: 0; color: #000; font-size: 10.5pt; line-height: 1.35; }
    .page { max-width: 7.3in; margin: 0 auto; }
    .header-band { border-top: 3px solid #1a5c2e; border-bottom: 1px solid #1a5c2e; padding: 8px 0 6px; margin-bottom: 8px; }
    .header-row { display: grid; grid-template-columns: 72px 1fr; gap: 10px; align-items: center; }
    .logo img { width: 68px; height: 68px; object-fit: contain; display: block; }
    .header-text { text-align: center; font-size: 9pt; text-transform: uppercase; }
    .header-text .line-2, .header-text .line-3 { font-weight: 700; margin-top: 2px; }
    .header-text .line-3 { font-size: 11pt; }
    .header-text .line-4 { font-size: 10pt; font-weight: 700; color: #1a5c2e; margin-top: 4px; }
    .header-text .line-5 { font-size: 8.5pt; margin-top: 4px; text-transform: none; }
    .doc-title { text-align: center; font-size: 13pt; font-weight: 700; text-transform: uppercase; text-decoration: underline; margin: 10px 0; }
    .section-heading { font-weight: 700; font-size: 10pt; text-transform: uppercase; margin: 10px 0 4px; }
    table.fields { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    table.fields td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; font-size: 9.5pt; }
    table.fields td.label { width: 22%; font-weight: 700; background: #f3f4f6; }
    table.fields td.value { white-space: pre-wrap; }
    table.fields td.value.pre { font-family: inherit; }
    table.data-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    table.data-table th, table.data-table td { border: 1px solid #000; padding: 4px 6px; font-size: 9pt; text-align: left; vertical-align: top; }
    table.data-table th { font-weight: 700; background: #e5e7eb; text-transform: uppercase; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; }
    .signature-block { text-align: center; }
    .signature-line { border-bottom: 1px solid #000; min-height: 28px; margin: 24px 12px 4px; font-weight: 700; font-size: 10pt; }
    .signature-caption { font-size: 9pt; text-transform: uppercase; }
    .signature-role { font-size: 9pt; margin-top: 2px; }
    @media print { body { margin: 0; } }
`

export function InspectionReportPrint({ document, report }: InspectionReportPrintProps) {
  const logoUrl = PANABO_LOGO_PATH

  return (
    <div id="inspection-report-print" className="bg-white text-black">
      <style>{PRINT_STYLES}</style>
      <div
        dangerouslySetInnerHTML={{
          __html: buildEvaluationReportHtml(document, report, logoUrl),
        }}
      />
    </div>
  )
}

export function printInspectionReport(document: Document, report: InspectionReport) {
    const printWindow = window.open("", "_blank", "width=900,height=700")
    if (!printWindow) {
        return
    }

    const logoUrl = getPanaboLogoUrl()
    const prefill = buildInspectionReportPrefill(document)
    const body = buildEvaluationReportHtml(document, report, logoUrl)

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <title>Evaluation Report - ${escapeHtml(prefill.locationalClearanceNumber)}</title>
            <style>${PRINT_STYLES}</style>
        </head>
        <body>
            ${body}
            <script>
                window.onload = function() {
                    var img = document.querySelector(".logo img");
                    function doPrint() { window.print(); }
                    if (img && !img.complete) {
                        img.onload = doPrint;
                        img.onerror = doPrint;
                    } else {
                        doPrint();
                    }
                };
            </script>
        </body>
        </html>
    `)
    printWindow.document.close()
}
