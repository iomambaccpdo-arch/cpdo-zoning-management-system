import axiosInstance from "../lib/axios";

export interface DocumentAttachment {
  id: number;
  document_id: number;
  uploaded_by?: number | null;
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  attachment_type?: 'document' | 'oic';
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

export interface InspectionReport {
  id: number;
  document_id: number;
  inspector_id: number;
  status: 'draft' | 'submitted';
  date_of_report: string | null;
  project_life_span: string | null;
  project_significance: string | null;
  right_over_land: string | null;
  area_details: string | null;
  location_details: string | null;
  inspection_date: string | null;
  project_status_as_of_inspection: string | null;
  gps_coordinates: string | null;
  information_provided_in_order: string | null;
  information_provided_findings: string | null;
  abutting_north: string | null;
  abutting_south: string | null;
  abutting_east: string | null;
  abutting_west: string | null;
  legal_bases: string | null;
  findings_evaluation: string | null;
  road_category: string | null;
  road_standard_rrow: string | null;
  road_actual_rrow: string | null;
  road_min_setback: string | null;
  road_as_per_plan: string | null;
  road_remarks: string | null;
  parking_building_code: string | null;
  parking_space_requirement: string | null;
  parking_remarks: string | null;
  type_of_lot: string | null;
  front_setback: string | null;
  distance_center_line_to_building: string | null;
  decision_recommended: string | null;
  inspector_signature: string | null;
  inspector_designation: string | null;
  noted_by_signature: string | null;
  noted_by_designation: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  inspector?: {
    id: number;
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    designation?: string | null;
  };
}

export interface InspectionReportPayload {
  dateOfReport?: string;
  projectLifeSpan?: string;
  projectSignificance?: string;
  rightOverLand?: string;
  areaDetails?: string;
  locationDetails?: string;
  inspectionDate?: string;
  projectStatusAsOfInspection?: string;
  gpsCoordinates?: string;
  informationProvidedInOrder?: string;
  informationProvidedFindings?: string;
  abuttingNorth?: string;
  abuttingSouth?: string;
  abuttingEast?: string;
  abuttingWest?: string;
  legalBases?: string;
  findingsEvaluation?: string;
  roadCategory?: string;
  roadStandardRrow?: string;
  roadActualRrow?: string;
  roadMinSetback?: string;
  roadAsPerPlan?: string;
  roadRemarks?: string;
  parkingBuildingCode?: string;
  parkingSpaceRequirement?: string;
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
  received_by: string;
  assisted_by: string | null;
  oic: string;
  barangay_id: number;
  purok_id: number;
  landmark: string;
  coordinates: string | null;
  floor_area: string;
  lot_area: string;
  storey: string;
  mezanine: string | null;
  status?: 'pending' | 'processing' | 'completed' | 'finalized';
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

  static async createDocument(data: FormData, onUploadProgress?: (progressEvent: any) => void) {
    const response = await axiosInstance.post("/api/documents", data, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
    return response.data;
  }

  static async updateDocument(id: number, data: FormData, onUploadProgress?: (progressEvent: any) => void) {
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

  static async uploadDocumentAttachments(documentId: number, files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files[]", file));

    const response = await axiosInstance.post<UploadDocumentAttachmentsResponse>(
      `/api/documents/${documentId}/attachments`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );

    return response.data;
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

  static async updateStatus(documentId: number, status: string) {
    const response = await axiosInstance.put(`/api/documents/${documentId}/status`, {
      status,
    });
    return response.data;
  }

  static async updateOic(documentId: number, userId: number) {
    const response = await axiosInstance.put(`/api/documents/${documentId}/oic`, {
      user_id: userId,
    });
    return response.data;
  }

  static async uploadOicAttachment(documentId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post(`/api/documents/${documentId}/oic-attachment`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
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
