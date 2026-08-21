import {
    LOCATIONAL_CLEARANCE_COPY_LABELS,
    type LocationalClearanceCopyVariant,
    type LocationalClearanceData,
} from "~/lib/locational-clearance-utils"
import { getLcFooterUrl, getLcHeaderUrl } from "~/lib/public-assets"

export type { LocationalClearanceCopyVariant }

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

function buildLocationalClearancePageHtml(
    data: LocationalClearanceData,
    copy: LocationalClearanceCopyVariant,
    headerUrl: string,
    footerUrl: string,
): string {
    const recommending = splitOfficer(data.recommendingApprovalOfficer)
    const approving = splitOfficer(data.approvingOfficer)
    const copyLabel = LOCATIONAL_CLEARANCE_COPY_LABELS[copy]

    return `
        <div class="sheet" data-copy="${copy}">
            <img class="band header-band" src="${headerUrl}" alt="City Planning and Development Office" />

            <h1 class="doc-title">LOCATIONAL CLEARANCE</h1>
            <div class="copy-label">${copyLabel ? escapeHtml(copyLabel) : "&nbsp;"}</div>

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
                        ${stackedCell("TYPE OF PROJECT:", val(data.projectType, false))}
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
                            <div class="lbl">RIGHT OVER LAND:</div>
                            <div class="data">${val(data.rightOverLand, false)}</div>
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
                    <p>Date of Inspection and LC Prepared: ${escapeHtml(blank(data.dateOfInspectionAndLcPrepared))}</p>
                </div>
            </div>

            <div class="footer-wrap">
                <img class="band footer-band" src="${footerUrl}" alt="" />
            </div>
        </div>
    `
}

const PRINT_STYLES = `
    @page {
        size: 8.5in 13in;
        margin: 0;
    }
    * { box-sizing: border-box; }
    html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff;
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 10.5pt;
        line-height: 1.18;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .sheet {
        position: relative;
        width: 8.5in;
        height: 13in;
        padding: 0 0.28in 0.82in;
        margin: 0;
        overflow: hidden;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid;
        break-inside: avoid;
    }
    .sheet:last-child {
        page-break-after: auto;
        break-after: auto;
    }
    .band {
        display: block;
        width: 100%;
        max-width: none;
    }
    .header-band {
        width: calc(100% + 0.56in);
        height: 1.05in;
        object-fit: fill;
        object-position: center top;
        margin: 0 -0.28in 2px;
    }
    .footer-wrap {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        width: 8.5in;
        height: 0.72in;
        overflow: hidden;
        line-height: 0;
        background: #007236;
    }
    .footer-band {
        width: 100%;
        height: 0.72in;
        object-fit: cover;
        object-position: left center;
        margin: 0;
        display: block;
    }
    .doc-title {
        text-align: center;
        font-size: 16pt;
        font-weight: 700;
        margin: 1px 0 0;
        letter-spacing: 0.01em;
    }
    .copy-label {
        text-align: right;
        font-size: 10.5pt;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin: 0 2px 3px;
    }
    table.lc-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin-bottom: 4px;
    }
    table.lc-table td {
        border: 1px solid #000;
        padding: 2px 5px 3px;
        vertical-align: top;
        font-size: 10.5pt;
    }
    .lbl { font-weight: 700; }
    .data {
        font-weight: 700;
        white-space: pre-wrap;
        min-height: 1.1em;
    }
    .decision { font-weight: 400; }
    .conditions { margin: 3px 2px 4px; }
    .conditions-title {
        text-align: center;
        font-weight: 700;
        font-size: 10.5pt;
        margin: 0 0 3px;
    }
    .additional-title {
        font-weight: 700;
        font-size: 10pt;
        margin: 4px 0 2px;
    }
    .condition {
        display: grid;
        grid-template-columns: 14px 1fr;
        gap: 4px;
        margin: 0 0 1px;
        font-size: 9.5pt;
        font-weight: 400;
        align-items: start;
    }
    .condition .bullet {
        font-size: 8.5pt;
        line-height: 1.3;
    }
    .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 28px;
        margin: 6px 4px 0;
        page-break-inside: avoid;
        break-inside: avoid;
        align-items: start;
    }
    .sig { text-align: center; }
    .authority {
        font-weight: 700;
        font-size: 10pt;
        margin: 0 0 4px;
        text-align: left;
        min-height: 1.2em;
        line-height: 1.2em;
    }
    .authority-spacer {
        visibility: hidden;
    }
    .sig-label {
        text-align: left;
        font-size: 10.5pt;
        margin: 0;
    }
    .sig-space { height: 28px; }
    .officer-name {
        font-weight: 700;
        font-size: 10pt;
        margin: 0;
    }
    .officer-title {
        font-size: 10pt;
        margin: 0;
    }
    .meta-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 28px;
        margin: 8px 4px 0;
        font-size: 9pt;
        page-break-inside: avoid;
        break-inside: avoid;
    }
    .meta p { margin: 0 0 1px; }
    .meta.left { text-align: left; padding-left: 0; }
    .meta.right { text-align: left; }
    @media screen {
        html, body {
            background: #d8d8d8;
        }
        .sheet {
            background: #fff;
            margin: 12px auto;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.18);
        }
    }
    @media print {
        html, body {
            width: 8.5in;
            background: #fff;
        }
        .sheet {
            margin: 0;
            box-shadow: none;
        }
    }
`

function copyWindowTitle(
    data: LocationalClearanceData,
    copies: LocationalClearanceCopyVariant[],
): string {
    const application = data.applicationNumber
    if (copies.length === 1) {
        const label = LOCATIONAL_CLEARANCE_COPY_LABELS[copies[0]]
        return label
            ? `Locational Clearance - ${label} - ${application}`
            : `Locational Clearance - ${application}`
    }

    return `Locational Clearance - ${application}`
}

export interface OpenLocationalClearancePrintOptions {
    copies?: LocationalClearanceCopyVariant[]
    autoPrint?: boolean
}

export function openLocationalClearancePrint(
    data: LocationalClearanceData,
    options: OpenLocationalClearancePrintOptions = {},
) {
    const copies = options.copies?.length ? options.copies : (["cpdo"] as LocationalClearanceCopyVariant[])
    const autoPrint = options.autoPrint ?? true
    const printWindow = window.open("", "_blank", "width=920,height=780")
    if (!printWindow) {
        return
    }

    const headerUrl = getLcHeaderUrl()
    const footerUrl = getLcFooterUrl()
    const body = copies
        .map((copy) => buildLocationalClearancePageHtml(data, copy, headerUrl, footerUrl))
        .join("")

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <title>${escapeHtml(copyWindowTitle(data, copies))}</title>
            <style>${PRINT_STYLES}</style>
        </head>
        <body>
            ${body}
            <script>
                window.onload = function() {
                    var autoPrint = ${autoPrint ? "true" : "false"};
                    if (!autoPrint) {
                        return;
                    }
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

export function viewLocationalClearance(
    data: LocationalClearanceData,
    copies: LocationalClearanceCopyVariant[] = ["cpdo", "client"],
) {
    openLocationalClearancePrint(data, { copies, autoPrint: false })
}

export function printLocationalClearanceCopy(
    data: LocationalClearanceData,
    copy: LocationalClearanceCopyVariant,
) {
    openLocationalClearancePrint(data, { copies: [copy], autoPrint: true })
}

export function printBothLocationalClearanceCopies(data: LocationalClearanceData) {
    openLocationalClearancePrint(data, { copies: ["cpdo", "client"], autoPrint: true })
}

export function printLocationalClearance(data: LocationalClearanceData) {
    printLocationalClearanceCopy(data, "cpdo")
}
