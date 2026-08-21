import * as React from "react"
import { format } from "date-fns"
import type { Document, InspectionReport } from "~/api/DocumentService"
import { deduplicatePurokPrefix } from "~/lib/document-property-utils"
import {
    buildInspectionReportPrefill,
    COORDINATES_VERIFICATION_STATUSES,
    collectInspectionFindings,
    formatParkingSpaceRequirement,
    getCoordinatesVerificationStatus,
    getProjectTypeVerificationStatus,
    normalizeFrontages,
    PROJECT_STATUS_OPTIONS,
    PROJECT_TYPE_VERIFICATION_STATUSES,
    resolveVerifiedCoordinates,
    resolvedVerifiedValue,
} from "~/lib/inspection-report-utils"
import {
    CPDO_LOGO_PATH,
    getCpdoLogoUrl,
    getPanaboLogoUrl,
    PANABO_LOGO_PATH,
} from "~/lib/public-assets"
import { formatArea, formatLength } from "~/lib/measurement-utils"

interface InspectionReportPrintProps {
    document: Document
    report: InspectionReport
}

function formatDate(value: string | null | undefined): string {
    if (!value) return ""
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
    return value?.trim() || ""
}

function displayLength(value: string | null | undefined): string {
    return formatLength(value) || ""
}

function checkbox(label: string, selected: boolean): string {
    return `${selected ? "(X)" : "( )"} ${label}`
}

function verifiedValueCell(
    report: InspectionReport,
    key: string,
    encodedValue: string,
    colspan = 3,
): string {
    const value = resolvedVerifiedValue(
        encodedValue,
        report.field_verifications ?? undefined,
        key,
    )
    return `<td class="value" colspan="${colspan}">${escapeHtml(display(value))}</td>`
}

function buildEvaluationReportHtml(
    document: Document,
    report: InspectionReport,
    panaboLogoUrl: string,
    cpdoLogoUrl: string,
): string {
    const prefill = buildInspectionReportPrefill(document)
    const significance = report.project_significance ?? ""
    const status = report.project_status_as_of_inspection ?? ""
    const hasBuildingsOrLots = prefill.buildings.length > 0 || prefill.lots.length > 0
    const verifiedCoordinates = resolveVerifiedCoordinates(
        document.coordinates,
        report.field_verifications,
        report.gps_coordinates,
    )
    const coordinatesStatus = getCoordinatesVerificationStatus(
        document.coordinates,
        report.field_verifications,
        report.gps_coordinates,
    )
    const projectTypeStatus = getProjectTypeVerificationStatus(
        prefill.encodedProjectType,
        report.field_verifications,
    )
    const verifiedProjectType = resolvedVerifiedValue(
        prefill.projectType,
        report.field_verifications,
        "project_type",
    )

    const areaRows = hasBuildingsOrLots
        ? [
            ...prefill.lots.flatMap((lot, index) => [
                `<tr>
                    <td class="label">Lot ${index + 1} Land Title / TCT</td>
                    ${verifiedValueCell(report, `lot_${index}_land_title`, lot.land_title)}
                </tr>`,
                `<tr>
                    <td class="label">Lot ${index + 1} Area</td>
                    ${verifiedValueCell(report, `lot_${index}_area`, formatArea(lot.area))}
                </tr>`,
            ]),
            ...prefill.buildings.flatMap((building, index) => [
                `<tr>
                    <td class="label">Building ${index + 1} Name</td>
                    ${verifiedValueCell(report, `building_${index}_name`, building.name)}
                </tr>`,
                `<tr>
                    <td class="label">Building ${index + 1} Area</td>
                    ${verifiedValueCell(report, `building_${index}_area`, formatArea(building.area))}
                </tr>`,
            ]),
        ].join("")
        : `<tr>
            <td class="label">Project Area</td>
            ${verifiedValueCell(report, "area_details", prefill.areaDetails || report.area_details || "")}
        </tr>`

    const frontages = normalizeFrontages(report.frontages, {
        road_category: report.road_category,
        road_standard_rrow: report.road_standard_rrow,
        road_actual_rrow: report.road_actual_rrow,
        road_min_setback: report.road_min_setback,
        road_as_per_plan: report.road_as_per_plan,
        front_setback: report.front_setback,
    })
    const recommendationFindings = Array.isArray(report.recommendation_findings)
        ? report.recommendation_findings.filter((finding) => finding.trim() !== "")
        : collectInspectionFindings({
            projectZoningClassification: resolvedVerifiedValue(
                prefill.projectClassification,
                report.field_verifications,
                "project_classification",
            ),
            siteZoningClassification: resolvedVerifiedValue(
                prefill.siteZoningClassification,
                report.field_verifications,
                "site_zoning_classification",
            ),
            hasInspectionPhotos: true,
            frontages,
            distanceCenterLineToBuilding: report.distance_center_line_to_building,
            parkingSpaceRequirement: report.parking_space_requirement,
            parkingAsPerPlan: report.parking_as_per_plan,
            lackingDocuments: report.lacking_documents,
            fieldVerifications: report.field_verifications,
            coordinatesNeedVerification:
                coordinatesStatus === COORDINATES_VERIFICATION_STATUSES.NOT_YET_VERIFIED,
        })

    return `
        <div class="page">
            <div class="header-band">
                <div class="header-row">
                    <div class="logo logo-left"><img src="${panaboLogoUrl}" alt="City of Panabo" /></div>
                    <div class="header-text">
                        <div>Republic of the Philippines</div>
                        <div class="line-2">Province of Davao del Norte</div>
                        <div class="line-3">City of Panabo</div>
                        <div class="line-4">City Planning &amp; Development Office</div>
                        <div class="line-5">Tel. (084) 823-4600 &nbsp; e-mail address: cpdopanabo@gmail.com</div>
                    </div>
                    <div class="logo logo-right"><img src="${cpdoLogoUrl}" alt="City Planning and Development Office" /></div>
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

            <p class="section-heading">I. APPLICANT AND PROJECT DESCRIPTION</p>
            <table class="fields">
                <tr>
                    <td class="label">Name of Applicant</td>
                    ${verifiedValueCell(report, "applicant_name", prefill.applicantName)}
                </tr>
                <tr>
                    <td class="label">Address of Applicant</td>
                    ${verifiedValueCell(report, "applicant_address", prefill.applicantAddress)}
                </tr>
                <tr>
                    <td class="label">Name of Corporation</td>
                    ${verifiedValueCell(report, "corporation_name", prefill.corporationName)}
                </tr>
                <tr>
                    <td class="label">Address of Corporation</td>
                    ${verifiedValueCell(report, "corporation_address", prefill.corporationAddress)}
                </tr>
                <tr>
                    <td class="label">Project Type</td>
                    <td class="value" colspan="3">${escapeHtml(display(verifiedProjectType))}</td>
                </tr>
                <tr>
                    <td class="label">Project Type Verification</td>
                    <td class="value" colspan="3">${escapeHtml(projectTypeStatus)}</td>
                </tr>
                ${projectTypeStatus === PROJECT_TYPE_VERIFICATION_STATUSES.VERIFIED_CORRECTED
                    ? `<tr>
                    <td class="label">Encoded Project Type</td>
                    <td class="value" colspan="3">${escapeHtml(display(prefill.projectType))}</td>
                </tr>`
                    : ""}
                ${areaRows}
                <tr>
                    <td class="label">Project Location — Address</td>
                    ${verifiedValueCell(report, "location", deduplicatePurokPrefix(prefill.locationDetails || report.location_details || ""))}
                </tr>
                <tr>
                    <td class="label">Landmark</td>
                    <td class="value pre" colspan="3">${escapeHtml(display(report.landmark))}</td>
                </tr>
                <tr>
                    <td class="label">Geographic Coordinates</td>
                    <td class="value" colspan="3">${escapeHtml(display(verifiedCoordinates))}</td>
                </tr>
                <tr>
                    <td class="label">Coordinate Verification</td>
                    <td class="value" colspan="3">${escapeHtml(coordinatesStatus)}</td>
                </tr>
                ${coordinatesStatus === COORDINATES_VERIFICATION_STATUSES.VERIFIED_CORRECTED
                    ? `<tr>
                    <td class="label">Encoded Coordinates</td>
                    <td class="value" colspan="3">${escapeHtml(display(document.coordinates))}</td>
                </tr>`
                    : ""}
                <tr>
                    <td class="label">Project Zoning Classification</td>
                    ${verifiedValueCell(report, "project_classification", prefill.projectClassification)}
                </tr>
            </table>

            <p class="section-heading">II. PROJECT EVALUATION</p>
            <table class="fields">
                <tr>
                    <td class="label">Site Zoning Classification</td>
                    ${verifiedValueCell(report, "site_zoning_classification", prefill.siteZoningClassification)}
                </tr>
                <tr>
                    <td class="label">Project Significance</td>
                    <td class="value" colspan="3">${checkbox("Local Significance", significance === "Local Significance")} &nbsp; ${checkbox("National Significance", significance === "National Significance")}</td>
                </tr>
                <tr>
                    <td class="label">Right Over Land</td>
                    <td class="value" colspan="3">${escapeHtml(display(report.right_over_land))}</td>
                </tr>
                <tr>
                    <td class="label">Date of Inspection</td>
                    <td class="value" colspan="3">${escapeHtml(formatDate(report.inspection_date))}</td>
                </tr>
                <tr>
                    <td class="label">Project Status as of Inspection Date</td>
                    <td class="value" colspan="3">
                        ${PROJECT_STATUS_OPTIONS.map((option) => checkbox(option, status === option)).join(" &nbsp; ")}
                        ${status && !(PROJECT_STATUS_OPTIONS as readonly string[]).includes(status) ? escapeHtml(status) : ""}
                    </td>
                </tr>
                <tr>
                    <td class="label">Land Uses of Abutting Lots</td>
                    <td class="value" colspan="3">
                        North: ${escapeHtml(display(report.abutting_north))} &nbsp;
                        East: ${escapeHtml(display(report.abutting_east))} &nbsp;
                        South: ${escapeHtml(display(report.abutting_south))} &nbsp;
                        West: ${escapeHtml(display(report.abutting_west))}
                    </td>
                </tr>
                <tr>
                    <td class="label">Project Lot Type</td>
                    <td class="value">${escapeHtml(display(report.type_of_lot))}</td>
                    <td class="label">Lacking Documents</td>
                    <td class="value">${escapeHtml(display(report.lacking_documents))}</td>
                </tr>
                ${report.findings_evaluation?.trim() ? `<tr>
                    <td class="label">Findings / Evaluation of Facts</td>
                    <td class="value pre" colspan="3">${escapeHtml(display(report.findings_evaluation))}</td>
                </tr>` : ""}
            </table>

            <table class="data-table rrow-table">
                <colgroup>
                    <col class="col-frontage" />
                    <col class="col-road-name" />
                    <col class="col-rrow" />
                    <col class="col-rrow" />
                    <col class="col-frontage-m" />
                    <col class="col-setback" />
                    <col class="col-setback" />
                    <col class="col-centerline" />
                </colgroup>
                <thead>
                    <tr>
                        <th>Frontage</th>
                        <th>Road Name</th>
                        <th>Standard RROW</th>
                        <th>Actual RROW</th>
                        <th>Frontage (m)</th>
                        <th>Setback Min. Requirement</th>
                        <th>Setback As Per Plan</th>
                        <th>Distance from the Centerline of the Road to the Building</th>
                    </tr>
                </thead>
                <tbody>
                    ${frontages.map((road, index) => `
                    <tr>
                        <td>${escapeHtml(display(road.label))}</td>
                        <td>${escapeHtml(display(road.name))}</td>
                        <td>${escapeHtml(displayLength(road.standardRrow))}</td>
                        <td>${escapeHtml(displayLength(road.actualRrow))}</td>
                        <td>${escapeHtml(displayLength(road.frontage))}</td>
                        <td>${escapeHtml(displayLength(road.minSetback))}</td>
                        <td>${escapeHtml(displayLength(road.asPerPlan))}</td>
                        ${index === 0 ? `<td rowspan="${frontages.length}">${escapeHtml(displayLength(report.distance_center_line_to_building))}</td>` : ""}
                    </tr>`).join("")}
                </tbody>
            </table>

            <table class="data-table parking-table">
                <colgroup>
                    <col />
                    <col />
                    <col />
                    <col />
                </colgroup>
                <thead>
                    <tr>
                        <th>PD1096 — Rev. Building Code</th>
                        <th>Parking Minimum Requirement</th>
                        <th>Parking As Per Plan</th>
                        <th>Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${escapeHtml(display(report.parking_building_code))}</td>
                        <td>${escapeHtml(display(formatParkingSpaceRequirement(report.parking_space_requirement)))}</td>
                        <td>${escapeHtml(display(formatParkingSpaceRequirement(report.parking_as_per_plan)))}</td>
                        <td>${escapeHtml(display(report.parking_remarks))}</td>
                    </tr>
                </tbody>
            </table>

            <table class="fields">
                <tr>
                    <td class="label">Recommendation</td>
                    <td class="value pre" colspan="3">${escapeHtml(display(report.decision_recommended))}</td>
                </tr>
                ${recommendationFindings.length > 0 ? `<tr>
                    <td class="label">Requirements / Findings</td>
                    <td class="value" colspan="3">
                        <ul class="findings-list">
                            ${recommendationFindings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}
                        </ul>
                    </td>
                </tr>` : ""}
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
    @page {
        size: 8.5in 13in;
        margin: 0.5in 0.6in;
    }
    /* Keep first-page top margin at 0 so browser date/URL chrome stays off;
       .page padding-top supplies the visual top spacing on page 1 only. */
    @page :first {
        margin-top: 0;
        margin-right: 0.6in;
        margin-bottom: 0.5in;
        margin-left: 0.6in;
    }
    * { box-sizing: border-box; }
    html, body {
        margin: 0 !important;
        padding: 0 !important;
    }
    body {
        font-family: "Times New Roman", Times, serif;
        color: #000;
        font-size: 10.5pt;
        line-height: 1.35;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .page {
        width: 100%;
        max-width: none;
        margin: 0;
        padding: 0.5in 0 0;
    }
    .header-band {
        border-top: 3px solid #1a5c2e;
        border-bottom: 1px solid #1a5c2e;
        padding: 8px 0 6px;
        margin-bottom: 8px;
        page-break-after: avoid;
        break-after: avoid;
    }
    .header-row { display: grid; grid-template-columns: 72px 1fr 72px; gap: 10px; align-items: center; }
    .logo img { width: 68px; height: 68px; object-fit: contain; display: block; }
    .logo-right { justify-self: end; }
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
    table.fields td.value { white-space: pre-wrap; min-height: 1.35em; }
    table.fields td.value.pre { font-family: inherit; }
    .findings-list { margin: 0; padding-left: 1.15em; }
    .findings-list li { margin: 0 0 2px; }
    table.fields td.value:empty::after,
    table.data-table tbody td:empty::after { content: "\\00a0"; }
    table.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 8px 0; page-break-inside: auto; }
    table.data-table th, table.data-table td { border: 1px solid #000; padding: 4px 6px; font-size: 9pt; text-align: left; vertical-align: top; word-wrap: break-word; }
    table.data-table th { font-weight: 700; background: #e5e7eb; text-transform: uppercase; }
    table.data-table.rrow-table .col-frontage { width: 10%; }
    table.data-table.rrow-table .col-road-name { width: 13%; }
    table.data-table.rrow-table .col-rrow { width: 11%; }
    table.data-table.rrow-table .col-frontage-m { width: 10%; }
    table.data-table.rrow-table .col-setback { width: 14%; }
    table.data-table.rrow-table .col-centerline { width: 17%; }
    table.data-table thead { display: table-header-group; }
    table.data-table tr { page-break-inside: avoid; break-inside: avoid; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; page-break-inside: avoid; }
    .signature-block { text-align: center; }
    .signature-line { border-bottom: 1px solid #000; min-height: 28px; margin: 24px 12px 4px; font-weight: 700; font-size: 10pt; }
    .signature-caption { font-size: 9pt; text-transform: uppercase; }
    .signature-role { font-size: 9pt; margin-top: 2px; }
    @media print {
        @page {
            size: 8.5in 13in;
            margin: 0.5in 0.6in;
        }
        @page :first {
            margin-top: 0;
            margin-right: 0.6in;
            margin-bottom: 0.5in;
            margin-left: 0.6in;
        }
        html, body {
            margin: 0 !important;
            padding: 0 !important;
        }
        .page {
            width: 100%;
            max-width: none;
            padding: 0.5in 0 0;
        }
    }
`

export function InspectionReportPrint({ document, report }: InspectionReportPrintProps) {
  const panaboLogoUrl = PANABO_LOGO_PATH
  const cpdoLogoUrl = CPDO_LOGO_PATH

  return (
    <div id="inspection-report-print" className="bg-white text-black">
      <style>{PRINT_STYLES}</style>
      <div
        dangerouslySetInnerHTML={{
          __html: buildEvaluationReportHtml(document, report, panaboLogoUrl, cpdoLogoUrl),
        }}
      />
    </div>
  )
}

export function printInspectionReport(document: Document, report: InspectionReport) {
    const panaboLogoUrl = getPanaboLogoUrl()
    const cpdoLogoUrl = getCpdoLogoUrl()
    const body = buildEvaluationReportHtml(document, report, panaboLogoUrl, cpdoLogoUrl)

    // Dedicated print window: @page :first keeps top margin 0 (no browser chrome),
    // while later pages use 0.5in top margin so content is not flush to the edge.
    const printWindow = window.open("", "_blank", "width=900,height=700")
    if (!printWindow) {
        return
    }

    printWindow.document.open()
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <title></title>
            <style>
                ${PRINT_STYLES}
            </style>
        </head>
        <body>
            ${body}
        </body>
        </html>
    `)
    printWindow.document.close()

    const doPrint = () => {
        let closed = false
        const closeWindow = () => {
            if (closed) return
            closed = true
            printWindow.removeEventListener("afterprint", closeWindow)
            printWindow.close()
        }
        printWindow.addEventListener("afterprint", closeWindow)
        printWindow.focus()
        printWindow.print()
        window.setTimeout(closeWindow, 1000)
    }

    const waitForImagesThenPrint = () => {
        const images = Array.from(printWindow.document.images)
        const pending = images.filter((img) => !img.complete)
        if (pending.length === 0) {
            doPrint()
            return
        }

        let remaining = pending.length
        const onDone = () => {
            remaining -= 1
            if (remaining <= 0) doPrint()
        }
        pending.forEach((img) => {
            img.addEventListener("load", onDone, { once: true })
            img.addEventListener("error", onDone, { once: true })
        })
    }

    if (printWindow.document.readyState === "complete") {
        waitForImagesThenPrint()
    } else {
        printWindow.addEventListener("load", waitForImagesThenPrint, { once: true })
    }
}
