import type { AxiosProgressEvent } from "axios";
import axiosInstance from "../lib/axios";
import {
  createByteProgressTracker,
  DEFAULT_UPLOAD_CONCURRENCY,
  getUploadPercent,
  mapWithConcurrency,
} from "../lib/upload-utils";

export interface DocumentAttachment {
  id: number;
  document_id: number;
  uploaded_by?: number | null;
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  attachment_type?: 'document' | 'oic' | 'inspection_photo' | 'reviewed_inspection_report';
  inspection_report_id?: number | null;
  created_at: string;
  uploader?: {
    id: number;
    first_name: string;
    last_name: string;
  } | null;
  document?: {
    id: number;
    document_title: string;
    zoning_application_no: string;
    applicant_name: string;
    date_of_application: string;
    due_date: string | null;
    project_type?: { id: number; name: string };
    specific_project_type?: { id: number; name: string } | null;
    barangay?: { id: number; name: string };
    purok?: { id: number; name: string };
    landmark: string;
    routed_to_users?: { id: number; first_name: string; last_name: string }[];
  };
}

export interface DueDateExtension {
  id: number;
  document_id: number;
  days_added: number;
  previous_due_date: string;
  new_due_date: string;
  reason: string | null;
  created_at: string;
  extended_by?:
    | number
    | {
        id: number;
        first_name: string;
        last_name: string;
      };
}

export interface FieldVerificationEntry {
  verified: boolean;
  correction: string;
}

export interface FrontageRoad {
  key: string;
  label: string;
  name: string | null;
  standard_rrow: string | null;
  actual_rrow: string | null;
  min_setback: string | null;
  as_per_plan: string | null;
  frontage: string | null;
  remarks: string | null;
}

export interface ParkingSpaceRequirement {
  car?: string | null;
  bus?: string | null;
  articulated_vehicle?: string | null;
  standard_truck?: string | null;
  jeepney_shuttle?: string | null;
}

export interface InspectionReport {
  id: number;
  document_id: number;
  inspector_id: number;
  status: 'draft' | 'submitted';
  date_of_report: string | null;
  project_significance: string | null;
  right_over_land: string | null;
  area_details: string | null;
  location_details: string | null;
  landmark: string | null;
  field_verifications: Record<string, FieldVerificationEntry> | null;
  inspection_date: string | null;
  project_status_as_of_inspection: string | null;
  gps_coordinates: string | null;
  abutting_north: string | null;
  abutting_south: string | null;
  abutting_east: string | null;
  abutting_west: string | null;
  findings_evaluation: string | null;
  frontages: FrontageRoad[] | null;
  road_category: string | null;
  road_standard_rrow: string | null;
  road_actual_rrow: string | null;
  road_min_setback: string | null;
  road_as_per_plan: string | null;
  parking_building_code: string | null;
  parking_space_requirement: ParkingSpaceRequirement | null;
  parking_as_per_plan: ParkingSpaceRequirement | null;
  parking_remarks: string | null;
  type_of_lot: string | null;
  lacking_documents: string | null;
  front_setback: string | null;
  distance_center_line_to_building: string | null;
  decision_recommended: string | null;
  inspector_signature: string | null;
  inspector_designation: string | null;
  noted_by_signature: string | null;
  noted_by_designation: string | null;
  additional_conditions: string | null;
  recommended_for_approval_name: string | null;
  recommended_for_approval_designation: string | null;
  approved_by_name: string | null;
  approved_by_designation: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: number | null;
  submitted_at: string | null;
  submission_history?: Array<{
    date_of_report: string | null;
    submitted_at: string | null;
    inspector_id: number;
  }> | null;
  created_at: string;
  updated_at: string;
  inspector?: {
    id: number;
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    designation?: string | null;
  };
  reviewed_report_attachment?: DocumentAttachment | null;
}

export interface InspectionReportPayload {
  projectSignificance?: string;
  rightOverLand?: string;
  areaDetails?: string;
  locationDetails?: string;
  landmark?: string;
  fieldVerifications?: Record<string, FieldVerificationEntry>;
  inspectionDate?: string;
  projectStatusAsOfInspection?: string;
  gpsCoordinates?: string;
  abuttingNorth?: string;
  abuttingSouth?: string;
  abuttingEast?: string;
  abuttingWest?: string;
  findingsEvaluation?: string;
  frontages?: Array<{
    name?: string;
    standardRrow?: string;
    actualRrow?: string;
    minSetback?: string;
    asPerPlan?: string;
    frontage?: string;
    remarks?: string;
  }>;
  roadCategory?: string;
  roadStandardRrow?: string;
  roadActualRrow?: string;
  roadMinSetback?: string;
  roadAsPerPlan?: string;
  roadRemarks?: string;
  parkingBuildingCode?: string;
  parkingSpaceRequirement?: ParkingSpaceRequirement;
  parkingRemarks?: string;
  typeOfLot?: string;
  frontSetback?: string;
  distanceCenterLineToBuilding?: string;
  decisionRecommended?: string;
  inspectorSignature?: string;
  inspectorDesignation?: string;
  notedBySignature?: string;
  notedByDesignation?: string;
  submit?: boolean;
}

export interface InspectionReportResponse {
  report: InspectionReport | null;
  document?: Document;
  message?: string;
}

export interface LocationalClearanceData {
  applicationNumber: string;
  decisionNumber: string;
  dateReceived: string;
  dateApproved: string;
  dateRequirementsComplied: string;
  applicantName: string;
  corporationName: string;
  applicantAddress: string;
  corporationAddress: string;
  projectType: string;
  location: string;
  floorArea: string;
  lotArea: string;
  frontageAtMainRoad: string;
  typeOfLot: string;
  standardRoadRightOfWay: string;
  distanceCenterLineToBuilding: string;
  rightOverLand: string;
  decision: string;
  conditions: string;
  additionalConditions: string;
  recommendingApprovalOfficer: string;
  approvingOfficer: string;
  orNumber: string;
  amountPaid: string;
  datePaid: string;
  dateOfInspection: string;
  dateOfLcPrepared: string;
  documentTitle: string;
}

export interface LocationalClearanceResponse {
  eligible: boolean;
  reasons: string[];
  data: LocationalClearanceData;
  message?: string;
}

export interface DocumentBuilding {
  name: string;
  area: string;
}

export interface DocumentLot {
  land_title: string;
  area: string;
}

export interface Document {
  id: number;
  document_title: string;
  zoning_id: number;
  zoning_application_no: string;
  project_type_id: number;
  specific_project_type_id?: number | null;
  date_of_application: string;
  due_date: string | null;
  applicant_name: string;
  corporation_name?: string | null;
  corporation_address?: string | null;
  received_by: string;
  assisted_by: string | null;
  oic: string;
  barangay_id: number;
  purok_id: number;
  landmark: string;
  coordinates: string | null;
  buildings?: DocumentBuilding[] | null;
  lots?: DocumentLot[] | null;
  floor_area: string;
  lot_area: string;
  storey: string;
  mezanine: string | null;
  status?: 'encoding' | 'returned' | 'encoded' | 'inspected' | 'reviewed' | 'approved';
  created_at: string;
  zoning?: { id: number; name: string };
  project_type?: { id: number; name: string };
  specific_project_type?: { id: number; name: string } | null;
  barangay?: { id: number; name: string };
  purok?: { id: number; name: string };
  routed_to_users?: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  }[];
  attachments?: DocumentAttachment[];
  due_date_extensions?: DueDateExtension[];
  inspection_report?: InspectionReport | null;
}

export interface DashboardMonthCount {
  month: number;
  month_name: string;
  count: number;
}

export interface DashboardAttachment {
  id: number;
  document_id: number;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  document?: { id: number; document_title: string };
}

export interface DashboardData {
  monthly_counts: DashboardMonthCount[];
  recent_attachments: DashboardAttachment[];
  overdue_count: number;
  encoding_count?: number;
  returned_count?: number;
}

export interface OverdueDocument extends Document {
  days_overdue: number;
}

export interface PaginatedDocuments {
  data: Document[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PaginatedOverdueDocuments {
  data: OverdueDocument[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PaginatedAttachments {
  data: DocumentAttachment[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface UploadDocumentAttachmentsResponse {
  message: string;
  attachments: DocumentAttachment[];
}

export class DocumentService {
  static async getNextApplicationNo(documentTitle: string) {
    const response = await axiosInstance.get<{ applicationNo: string }>(
      "/api/documents/next-application-no",
      { params: { documentTitle } },
    );
    return response.data;
  }

  static async getDashboard(year?: number) {
    const response = await axiosInstance.get<DashboardData>("/api/dashboard", {
      params: year ? { year } : {},
    });
    return response.data;
  }

  static async getDocuments(params?: {
    search?: string;
    page?: number;
    per_page?: number;
    year?: number;
    month?: number;
    status?: string;
  }) {
    const response = await axiosInstance.get<PaginatedDocuments>(
      "/api/documents",
      { params },
    );
    return response.data;
  }

  static async getOverdueDocuments(params?: {
    page?: number;
    per_page?: number;
  }) {
    const response = await axiosInstance.get<PaginatedOverdueDocuments>(
      "/api/documents/overdue",
      { params },
    );
    return response.data;
  }

  static async createDocument(
    data: FormData,
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void,
  ) {
    const response = await axiosInstance.post("/api/documents", data, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
    return response.data;
  }

  static async updateDocument(
    id: number,
    data: FormData,
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void,
  ) {
    const response = await axiosInstance.post(`/api/documents/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
    return response.data;
  }

  static async deleteDocument(id: number) {
    const response = await axiosInstance.delete(`/api/documents/${id}`);
    return response.data;
  }

  static async getDocument(id: number) {
    const response = await axiosInstance.get<Document>(`/api/documents/${id}`);
    return response.data;
  }

  static async getAttachments(params?: {
    search?: string;
    page?: number;
    per_page?: number;
  }) {
    const response = await axiosInstance.get<PaginatedAttachments>(
      "/api/attachments",
      { params },
    );
    return response.data;
  }

  static async getDocumentAttachments(documentId: number) {
    const response = await axiosInstance.get<DocumentAttachment[]>(
      `/api/documents/${documentId}/attachments`,
    );
    return response.data;
  }

  static async uploadDocumentAttachments(
    documentId: number,
    files: File[],
    onUploadProgress?: (percent: number) => void,
  ) {
    if (files.length === 0) {
      return { message: "No files uploaded", attachments: [] as DocumentAttachment[] };
    }

    if (files.length === 1) {
      const formData = new FormData();
      formData.append("files[]", files[0]);

      const response = await axiosInstance.post<UploadDocumentAttachmentsResponse>(
        `/api/documents/${documentId}/attachments`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (event) => onUploadProgress?.(getUploadPercent(event)),
        },
      );

      return response.data;
    }

    const progress = createByteProgressTracker(
      files.map((file) => file.size),
      onUploadProgress,
    );

    const batches = await mapWithConcurrency(
      files,
      DEFAULT_UPLOAD_CONCURRENCY,
      async (file, index) => {
        const formData = new FormData();
        formData.append("files[]", file);

        const response = await axiosInstance.post<UploadDocumentAttachmentsResponse>(
          `/api/documents/${documentId}/attachments`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (event) => progress.update(index, event.loaded),
          },
        );

        progress.complete(index);
        return response.data.attachments;
      },
    );

    return {
      message: "Attachments uploaded successfully",
      attachments: batches.flat(),
    };
  }

  static async downloadAttachment(id: number, fileName: string) {
    const response = await axiosInstance.get(
      `/api/attachments/${id}/download`,
      {
        responseType: "blob",
      },
    );
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  static async deleteAttachment(id: number) {
    const response = await axiosInstance.delete(`/api/attachments/${id}`);
    return response.data;
  }

  static async extendDueDate(documentId: number, daysToAdd: number, reason: string) {
    const response = await axiosInstance.post(`/api/documents/${documentId}/extend-due-date`, {
      daysToAdd,
      reason,
    });
    return response.data;
  }

  static async submitApplication(documentId: number) {
    const response = await axiosInstance.post(`/api/documents/${documentId}/submit`);
    return response.data;
  }

  static async returnToEncoder(documentId: number) {
    const response = await axiosInstance.post(`/api/documents/${documentId}/return-to-encoder`);
    return response.data;
  }

  static async approveApplication(documentId: number) {
    const response = await axiosInstance.post(`/api/documents/${documentId}/approve`);
    return response.data;
  }

  static async updateOic(documentId: number, userId: number) {
    const response = await axiosInstance.put(`/api/documents/${documentId}/oic`, {
      user_id: userId,
    });
    return response.data;
  }

  static async uploadOicAttachment(
    documentId: number,
    file: File,
    onUploadProgress?: (percent: number) => void,
  ) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post(`/api/documents/${documentId}/oic-attachment`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (event) => onUploadProgress?.(getUploadPercent(event)),
    });
    return response.data;
  }

  static async getInspectionReport(documentId: number) {
    const response = await axiosInstance.get<InspectionReportResponse>(
      `/api/documents/${documentId}/inspection-report`,
    );
    return response.data;
  }

  static async createInspectionReport(documentId: number, payload: InspectionReportPayload) {
    const response = await axiosInstance.post<InspectionReportResponse>(
      `/api/documents/${documentId}/inspection-report`,
      payload,
    );
    return response.data;
  }

  static async updateInspectionReport(
    documentId: number,
    reportId: number,
    payload: InspectionReportPayload,
  ) {
    const response = await axiosInstance.put<InspectionReportResponse>(
      `/api/documents/${documentId}/inspection-report/${reportId}`,
      payload,
    );
    return response.data;
  }

  static async returnInspectionReportForRevision(documentId: number, reportId: number) {
    const response = await axiosInstance.post<InspectionReportResponse>(
      `/api/documents/${documentId}/inspection-report/${reportId}/return-for-revision`,
    );
    return response.data;
  }

  static async reviewInspectionReport(
    documentId: number,
    reportId: number,
    payload: {
      additionalConditions: string;
      recommendedForApprovalName: string;
      recommendedForApprovalDesignation: string;
      approvedByName: string;
      approvedByDesignation: string;
      reviewedReport: File;
    },
    onUploadProgress?: (percent: number) => void,
  ) {
    const formData = new FormData();
    formData.append("additionalConditions", payload.additionalConditions);
    formData.append("recommendedForApprovalName", payload.recommendedForApprovalName);
    formData.append(
      "recommendedForApprovalDesignation",
      payload.recommendedForApprovalDesignation,
    );
    formData.append("approvedByName", payload.approvedByName);
    formData.append("approvedByDesignation", payload.approvedByDesignation);
    formData.append("reviewedReport", payload.reviewedReport);

    const response = await axiosInstance.post<InspectionReportResponse>(
      `/api/documents/${documentId}/inspection-report/${reportId}/review`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => onUploadProgress?.(getUploadPercent(event)),
      },
    );
    return response.data;
  }

  static async getInspectionReportPhotos(documentId: number) {
    const response = await axiosInstance.get<DocumentAttachment[]>(
      `/api/documents/${documentId}/inspection-report/photos`,
    );
    return response.data;
  }

  static async uploadInspectionReportPhotos(
    documentId: number,
    files: File[],
    onUploadProgress?: (percent: number) => void,
  ) {
    if (files.length === 0) {
      return { message: "No photos uploaded", attachments: [] as DocumentAttachment[] };
    }

    if (files.length === 1) {
      const formData = new FormData();
      formData.append("files[]", files[0]);

      const response = await axiosInstance.post<{
        message: string;
        attachments: DocumentAttachment[];
      }>(`/api/documents/${documentId}/inspection-report/photos`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => onUploadProgress?.(getUploadPercent(event)),
      });

      return response.data;
    }

    const progress = createByteProgressTracker(
      files.map((file) => file.size),
      onUploadProgress,
    );

    const batches = await mapWithConcurrency(
      files,
      DEFAULT_UPLOAD_CONCURRENCY,
      async (file, index) => {
        const formData = new FormData();
        formData.append("files[]", file);

        const response = await axiosInstance.post<{
          message: string;
          attachments: DocumentAttachment[];
        }>(`/api/documents/${documentId}/inspection-report/photos`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (event) => progress.update(index, event.loaded),
        });

        progress.complete(index);
        return response.data.attachments;
      },
    );

    return {
      message: "Inspection photos uploaded successfully",
      attachments: batches.flat(),
    };
  }

  static async deleteInspectionReportPhoto(documentId: number, attachmentId: number) {
    const response = await axiosInstance.delete(
      `/api/documents/${documentId}/inspection-report/photos/${attachmentId}`,
    );
    return response.data;
  }

  static async getLocationalClearance(documentId: number) {
    const response = await axiosInstance.get<LocationalClearanceResponse>(
      `/api/documents/${documentId}/locational-clearance`,
    );
    return response.data;
  }

  static async generateLocationalClearance(documentId: number) {
    const response = await axiosInstance.post<LocationalClearanceResponse>(
      `/api/documents/${documentId}/locational-clearance/generate`,
    );
    return response.data;
  }
}
