import type { LocationalClearanceData } from "~/lib/locational-clearance-utils"
import { getLcFooterUrl, getLcHeaderUrl } from "~/lib/public-assets"

function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function blank(value: string | null | undefined): string {
    const text = value?.trim() ?? ""
    return text === "—" ? "" : text
}

function val(value: string | null | undefined, uppercase = true): string {
    const text = blank(value)
    if (!text) return ""
    return escapeHtml(uppercase ? text.toUpperCase() : text)
}

function splitOfficer(combined: string): { name: string; designation: string } {
    const text = blank(combined)
    if (!text) return { name: "", designation: "" }

    const comma = text.lastIndexOf(", ")
    if (comma === -1) return { name: text, designation: "" }

    return {
        name: text.slice(0, comma).trim(),
        designation: text.slice(comma + 2).trim(),
    }
}

function decisionNo(value: string): string {
    const text = blank(value)
    if (!text) return ""
    if (/^LC-/i.test(text)) return text
    return `LC-${text}`
}

function rightOverLandHtml(value: string | null | undefined): string {
    const text = blank(value)
    const normalized = text.toLowerCase()
    const isOwner = normalized === "owner"
    const isLeasee =
        normalized === "leasee" ||
        normalized === "lessee" ||
        normalized.startsWith("lease,") ||
        normalized.startsWith("lease ")
    const isOthers = Boolean(text) && !isOwner && !isLeasee
    const specify = isOthers ? text.toUpperCase() : ""

    return `
        <span class="rol">${isOwner ? "(X)" : "( )"} Owner</span>
        <span class="rol">${isLeasee ? "(X)" : "( )"} Leasee</span>
        <span class="rol">${isOthers ? "(X)" : "( )"} Others, specify :</span>
        ${specify ? `<span class="data">${escapeHtml(specify)}</span>` : ""}
    `
}

function conditionLines(content: string): string {
    return content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map(
            (line) =>
                `<p class="condition"><span class="bullet">&#9632;</span><span>${escapeHtml(line)}</span></p>`,
        )
        .join("")
}

function stackedCell(label: string, valueHtml: string): string {
    return `
        <td>
            <div class="lbl">${escapeHtml(label)}</div>
            <div class="data">${valueHtml}</div>
        </td>`
}

function inlineCell(label: string, valueHtml: string): string {
    return `
        <td>
            <span class="lbl">${escapeHtml(label)}</span>
            <span class="data">${valueHtml}</span>
        </td>`
}

function buildLocationalClearanceHtml(
    data: LocationalClearanceData,
    headerUrl: string,
    footerUrl: string,
): string {
    const recommending = splitOfficer(data.recommendingApprovalOfficer)
    const approving = splitOfficer(data.approvingOfficer)

    return `
        <div class="page">
            <img class="band header-band" src="${headerUrl}" alt="City Planning and Development Office" />

            <h1 class="doc-title">LOCATIONAL CLEARANCE</h1>
            <div class="received-copy">CPDO Received Copy</div>

            <table class="lc-table">
                <colgroup>
                    <col style="width:50%" />
                    <col style="width:50%" />
                </colgroup>
                <tbody>
                    <tr>
                        ${inlineCell("Application No.:", val(data.applicationNumber, false))}
                        ${inlineCell("Decision No.:", val(decisionNo(data.decisionNumber), false))}
                    </tr>
                    <tr>
                        ${inlineCell("Date Received:", val(data.dateReceived, false))}
                        ${inlineCell("Date Approved:", val(data.dateApproved, false))}
                    </tr>
                    <tr>
                        <td colspan="2">
                            <span class="lbl">Date Complete Requirements Complied:</span>
                            <span class="data">${val(data.dateRequirementsComplied, false)}</span>
                        </td>
                    </tr>
                    <tr>
                        ${stackedCell("APPLICANT:", val(data.applicantName))}
                        ${stackedCell("NAME OF CORPORATION :", val(data.corporationName))}
                    </tr>
                    <tr>
                        ${stackedCell("APPLICANT ADDRESS:", val(data.applicantAddress))}
                        ${stackedCell("ADDRESS OF CORPORATION :", val(data.corporationAddress))}
                    </tr>
                    <tr>
                        ${stackedCell("TYPE OF PROJECT:", val(data.projectType))}
                        ${stackedCell("LOCATION :", val(data.location))}
                    </tr>
                    <tr>
                        ${stackedCell("FLOOR AREA:", val(data.floorArea))}
                        ${stackedCell("LOT AREA:", val(data.lotArea))}
                    </tr>
                    <tr>
                        ${stackedCell("FRONTAGE AT MAIN ROAD:", val(data.frontageAtMainRoad))}
                        ${stackedCell("TYPE OF LOT:", val(data.typeOfLot))}
                    </tr>
                    <tr>
                        ${stackedCell("STANDARD ROAD RIGHT OF WAY:", val(data.standardRoadRightOfWay))}
                        ${stackedCell(
                            "Distance from the center line of the Road to the Building:",
                            val(data.distanceCenterLineToBuilding),
                        )}
                    </tr>
                    <tr>
                        <td colspan="2">
                            <div class="lbl">RIGHT OVER LAND</div>
                            <div class="rol-row">${rightOverLandHtml(data.rightOverLand)}</div>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2">
                            <div class="lbl">DECISION :</div>
                            <div class="data decision">${escapeHtml(blank(data.decision) || "LC- Granted and subject to the condition below:")}</div>
                        </td>
                    </tr>
                </tbody>
            </table>

            <section class="conditions">
                <p class="conditions-title">CONDITIONS:</p>
                ${conditionLines(data.conditions)}
                <p class="additional-title">Additional Conditions</p>
                ${conditionLines(data.additionalConditions)}
            </section>

            <div class="signatures">
                <div class="sig left">
                    <p class="authority authority-spacer" aria-hidden="true">&nbsp;</p>
                    <p class="sig-label">Recommending Approval:</p>
                    <div class="sig-space"></div>
                    <p class="officer-name">${escapeHtml(recommending.name)}</p>
                    <p class="officer-title">${escapeHtml(recommending.designation || "Zoning Officer III")}</p>
                </div>
                <div class="sig right">
                    <p class="authority">BY AUTHORITY OF THE LCE:</p>
                    <p class="sig-label">Approved by:</p>
                    <div class="sig-space"></div>
                    <p class="officer-name">${escapeHtml(approving.name)}</p>
                    <p class="officer-title">${escapeHtml(approving.designation || "City Planning & Development Coordinator")}</p>
                </div>
            </div>

            <div class="meta-row">
                <div class="meta left">
                    <p>OR No: ${escapeHtml(blank(data.orNumber))}</p>
                    <p>Amount Paid: ${escapeHtml(blank(data.amountPaid))}</p>
                    <p>Date Paid: ${escapeHtml(blank(data.datePaid))}</p>
                </div>
                <div class="meta right">
                    <p>Date of Inspection: ${escapeHtml(blank(data.dateOfInspection))}</p>
                    <p>Date of LC Prepared: ${escapeHtml(blank(data.dateOfLcPrepared))}</p>
                </div>
            </div>

            <div class="footer-wrap">
                <img class="band footer-band" src="${footerUrl}" alt="" />
            </div>
        </div>
    `
}

const PRINT_STYLES = `
    @page { size: 8.5in 14in; margin: 0.25in 0.3in 0.15in 0.3in; }
    * { box-sizing: border-box; }
    html, body {
        height: 100%;
    }
    body {
        margin: 0;
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 11.5pt;
        line-height: 1.2;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .page {
        width: 100%;
        margin: 0 auto;
        min-height: 13.6in;
        display: flex;
        flex-direction: column;
    }
    .band {
        display: block;
        width: 100%;
        max-width: none;
    }
    .header-band {
        height: 1.15in;
        object-fit: fill;
        object-position: center top;
        margin: 0 0 2px;
        flex: 0 0 auto;
    }
    .footer-wrap {
        width: 100%;
        margin-top: auto;
        overflow: hidden;
        line-height: 0;
        text-align: left;
        background: #007236;
        flex: 0 0 auto;
    }
    .footer-band {
        width: 100%;
        height: 0.78in;
        object-fit: cover;
        object-position: left center;
        margin: 0;
        display: block;
    }
    .doc-title {
        text-align: center;
        font-size: 17.5pt;
        font-weight: 700;
        margin: 2px 0 0;
        letter-spacing: 0.01em;
        flex: 0 0 auto;
    }
    .received-copy {
        text-align: right;
        font-size: 11.5pt;
        font-weight: 700;
        margin: 0 2px 4px;
        flex: 0 0 auto;
    }
    table.lc-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin-bottom: 6px;
        flex: 0 0 auto;
    }
    table.lc-table td {
        border: 1px solid #000;
        padding: 3px 5px 4px;
        vertical-align: top;
        font-size: 11.5pt;
    }
    .lbl { font-weight: 700; }
    .data {
        font-weight: 700;
        white-space: pre-wrap;
        min-height: 1.15em;
    }
    .decision { font-weight: 400; }
    .rol { margin-right: 10px; white-space: nowrap; }
    .rol-row { margin-top: 2px; }
    .conditions { margin: 6px 2px 8px; flex: 0 0 auto; }
    .conditions-title {
        text-align: center;
        font-weight: 700;
        font-size: 11.5pt;
        margin: 0 0 4px;
    }
    .additional-title {
        font-weight: 700;
        font-size: 10.5pt;
        margin: 6px 0 3px;
    }
    .condition {
        display: grid;
        grid-template-columns: 14px 1fr;
        gap: 4px;
        margin: 0 0 2px;
        font-size: 10.5pt;
        font-weight: 400;
        align-items: start;
    }
    .condition .bullet {
        font-size: 9pt;
        line-height: 1.35;
    }
    .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 28px;
        margin: 8px 4px 0;
        page-break-inside: avoid;
        flex: 0 0 auto;
        align-items: start;
    }
    .sig { text-align: center; }
    .authority {
        font-weight: 700;
        font-size: 10.5pt;
        margin: 0 0 6px;
        text-align: left;
        min-height: 1.25em;
        line-height: 1.25em;
    }
    .authority-spacer {
        visibility: hidden;
    }
    .sig-label {
        text-align: left;
        font-size: 11.5pt;
        margin: 0;
    }
    .sig-space { height: 40px; }
    .officer-name {
        font-weight: 700;
        font-size: 10.5pt;
        margin: 0;
    }
    .officer-title {
        font-size: 10.5pt;
        margin: 0;
    }
    .meta-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 28px;
        margin: 16px 4px 10px;
        font-size: 9.5pt;
        page-break-inside: avoid;
        flex: 0 0 auto;
    }
    .meta p { margin: 0 0 2px; }
    .meta.left { text-align: left; padding-left: 0; }
    .meta.right { text-align: left; }
    @media print {
        html, body { height: auto; }
        body { margin: 0; }
        .page {
            max-width: none;
            min-height: calc(14in - 0.4in);
        }
    }
`

export function printLocationalClearance(data: LocationalClearanceData) {
    const printWindow = window.open("", "_blank", "width=920,height=780")
    if (!printWindow) {
        return
    }

    const headerUrl = getLcHeaderUrl()
    const footerUrl = getLcFooterUrl()
    const body = buildLocationalClearanceHtml(data, headerUrl, footerUrl)

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
                    var images = Array.prototype.slice.call(document.images || []);
                    var pending = images.filter(function(img) { return !img.complete; }).length;
                    function doPrint() { window.print(); }
                    if (!pending) {
                        doPrint();
                        return;
                    }
                    images.forEach(function(img) {
                        if (img.complete) return;
                        img.onload = img.onerror = function() {
                            pending -= 1;
                            if (pending <= 0) doPrint();
                        };
                    });
                };
            </script>
        </body>
        </html>
    `)
    printWindow.document.close()
}
