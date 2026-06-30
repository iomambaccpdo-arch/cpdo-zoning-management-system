import type { LocationalClearanceData } from "~/lib/locational-clearance-utils"
import { getPanaboLogoUrl } from "~/lib/public-assets"

function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function display(value: string | null | undefined): string {
    return escapeHtml(value?.trim() || "_________________________")
}

function gridRow(labelLeft: string, valueLeft: string, labelRight?: string, valueRight?: string): string {
    if (!labelRight) {
        return `
            <tr>
                <td class="label">${escapeHtml(labelLeft)}</td>
                <td class="value full" colspan="3">${display(valueLeft)}</td>
            </tr>`
    }

    return `
        <tr>
            <td class="label">${escapeHtml(labelLeft)}</td>
            <td class="value">${display(valueLeft)}</td>
            <td class="label">${escapeHtml(labelRight)}</td>
            <td class="value">${display(valueRight)}</td>
        </tr>`
}

function conditionsBlock(title: string, content: string): string {
    const lines = content.split("\n").filter((line) => line.trim())
    const body = lines
        .map((line, index) => `<p class="condition-line">&#9632; ${index + 1}. ${escapeHtml(line.trim())}</p>`)
        .join("")

    return `
        <div class="conditions-section">
            <p class="conditions-title">${escapeHtml(title)}</p>
            ${body}
        </div>`
}

function buildLocationalClearanceHtml(data: LocationalClearanceData, logoUrl: string): string {
    return `
        <div class="page">
            <div class="header-band">
                <div class="header-row">
                    <div class="logo"><img src="${logoUrl}" alt="City of Panabo" /></div>
                    <div class="header-text">
                        <div class="line-1">Republic of the Philippines</div>
                        <div class="line-2">Province of Davao del Norte</div>
                        <div class="line-3">City of Panabo</div>
                        <div class="line-4">City Planning and Development Office</div>
                    </div>
                </div>
            </div>

            <div class="title-row">
                <h1 class="doc-title">Locational Clearance</h1>
                <span class="received-copy">CPDO Received Copy</span>
            </div>

            <table class="grid-fields">
                <tbody>
                    ${gridRow("Application No.", data.applicationNumber, "Decision No.", data.decisionNumber)}
                    ${gridRow("Date Received", data.dateReceived, "Date Approved", data.dateApproved)}
                    <tr>
                        <td class="label">Date Complete Requirements Complied</td>
                        <td class="value" colspan="3">${display(data.dateRequirementsComplied)}</td>
                    </tr>
                    ${gridRow("APPLICANT", data.applicantName, "NAME OF CORPORATION", data.corporationName)}
                    ${gridRow("APPLICANT ADDRESS", data.applicantAddress, "ADDRESS OF CORPORATION", data.corporationAddress)}
                    ${gridRow("TYPE OF PROJECT", data.projectType, "LOCATION", data.location)}
                    ${gridRow("FLOOR AREA", data.floorArea, "LOT AREA", data.lotArea)}
                    ${gridRow("FRONTAGE AT MAIN ROAD", data.frontageAtMainRoad, "TYPE OF LOT", data.typeOfLot)}
                    ${gridRow(
                        "STANDARD ROAD RIGHT OF WAY",
                        data.standardRoadRightOfWay,
                        "Distance from the center line of the Road to the Building",
                        data.distanceCenterLineToBuilding,
                    )}
                    <tr>
                        <td class="label">RIGHT OVER LAND</td>
                        <td class="value full" colspan="3">${display(data.rightOverLand)}</td>
                    </tr>
                    <tr>
                        <td class="label">DECISION</td>
                        <td class="value full" colspan="3">${display(data.decision)}</td>
                    </tr>
                </tbody>
            </table>

            ${conditionsBlock("Conditions", data.conditions)}
            ${conditionsBlock("Additional Conditions", data.additionalConditions)}

            <p class="authority-line">BY AUTHORITY OF THE LCE:</p>

            <div class="signatures">
                <div class="signature-block">
                    <p class="signature-label">Recommending Approval:</p>
                    <div class="signature-line">${display(data.recommendingApprovalOfficer)}</div>
                    <div class="payment-block">
                        <p>OR No. ${display(data.orNumber)}</p>
                        <p>Amount Paid ${display(data.amountPaid)}</p>
                        <p>Date Paid ${display(data.datePaid)}</p>
                    </div>
                </div>
                <div class="signature-block">
                    <p class="signature-label">Approved by:</p>
                    <div class="signature-line">${display(data.approvingOfficer)}</div>
                    <div class="dates-block">
                        <p>Date of Inspection: ${display(data.dateOfInspection)}</p>
                        <p>Date of LC Prepared: ${display(data.dateOfLcPrepared)}</p>
                    </div>
                </div>
            </div>

            <div class="footer-band">
                <div class="footer-main">City Planning &amp; Development Office — City of Panabo</div>
                <div>New City Hall Bldg., Panabo City · (084) 823-4600 · (084) 822-7415 · katcpdopanabo@gmail.com</div>
            </div>
        </div>
    `
}

const PRINT_STYLES = `
    @page { size: 8.5in 13in; margin: 0.55in 0.65in 0.6in 0.65in; }
    * { box-sizing: border-box; }
    body { font-family: "Times New Roman", Times, serif; color: #000; margin: 0; font-size: 11pt; line-height: 1.35; }
    .page { width: 100%; max-width: 7.2in; margin: 0 auto; }
    .header-band { border-top: 3px solid #1a5c2e; border-bottom: 1px solid #1a5c2e; padding: 10px 0 8px; margin-bottom: 10px; }
    .header-row { display: grid; grid-template-columns: 80px 1fr; gap: 12px; align-items: center; }
    .logo img { width: 72px; height: 72px; object-fit: contain; display: block; }
    .header-text { text-align: center; }
    .header-text .line-1 { font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; }
    .header-text .line-2, .header-text .line-3 { font-size: 10pt; font-weight: 700; text-transform: uppercase; margin-top: 2px; }
    .header-text .line-3 { font-size: 11pt; }
    .header-text .line-4 { font-size: 10pt; font-weight: 700; text-transform: uppercase; margin-top: 4px; color: #1a5c2e; }
    .title-row { display: flex; align-items: flex-end; justify-content: center; gap: 16px; margin: 14px 0 10px; position: relative; }
    .doc-title { text-align: center; font-size: 14pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; text-decoration: underline; text-underline-offset: 4px; }
    .received-copy { font-size: 8pt; position: absolute; right: 0; bottom: 2px; }
    table.grid-fields { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    table.grid-fields td { border: 1px solid #000; padding: 5px 8px; vertical-align: top; font-size: 10pt; }
    table.grid-fields td.label { width: 22%; font-weight: 700; background: #f3f4f6; }
    table.grid-fields td.value { width: 28%; white-space: pre-wrap; }
    table.grid-fields td.value.full { width: auto; }
    .conditions-section { border: 1px solid #000; padding: 10px 12px; margin-bottom: 12px; page-break-inside: avoid; }
    .conditions-title { font-weight: 700; text-transform: uppercase; font-size: 10pt; margin: 0 0 8px; text-decoration: underline; }
    .condition-line { margin: 0 0 6px; font-size: 10pt; white-space: pre-wrap; }
    .authority-line { font-size: 9.5pt; text-align: right; margin: 8px 0 4px; font-weight: 700; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 20px; page-break-inside: avoid; }
    .signature-block { text-align: center; }
    .signature-label { font-size: 9.5pt; margin: 0 0 4px; }
    .signature-line { border-bottom: 1px solid #000; min-height: 28px; margin: 28px 16px 4px; font-weight: 700; font-size: 10pt; padding-bottom: 2px; }
    .signature-caption { font-size: 9pt; margin: 0; }
    .payment-block, .dates-block { margin-top: 16px; font-size: 9pt; text-align: left; padding-left: 16px; }
    .payment-block p, .dates-block p { margin: 0 0 4px; }
    .footer-band { margin-top: 20px; border-top: 2px solid #1a5c2e; padding-top: 6px; text-align: center; font-size: 8.5pt; color: #444; }
    .footer-band .footer-main { font-weight: 700; text-transform: uppercase; color: #1a5c2e; font-size: 9pt; }
    @media print { body { margin: 0; } .page { max-width: none; } }
`

export function printLocationalClearance(data: LocationalClearanceData) {
    const printWindow = window.open("", "_blank", "width=920,height=780")
    if (!printWindow) {
        return
    }

    const logoUrl = getPanaboLogoUrl()
    const body = buildLocationalClearanceHtml(data, logoUrl)

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <title>Locational Clearance - ${escapeHtml(data.applicationNumber)}</title>
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
