import axiosInstance from "../lib/axios";

export interface DocumentAttachment {
  id: number;
  document_id: number;
  uploaded_by?: number | null;
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
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
    barangay?: { id: number; name: string };
    purok?: { id: number; name: string };
    landmark: string;
    routed_to_users?: { id: number; first_name: string; last_name: string }[];
  };
}

export interface Document {
  id: number;
  document_title: string;
  zoning_id: number;
  zoning_application_no: string;
  project_type_id: number;
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
  created_at: string;
  zoning?: { id: number; name: string };
  project_type?: { id: number; name: string };
  barangay?: { id: number; name: string };
  purok?: { id: number; name: string };
  routed_to_users?: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  }[];
  attachments?: DocumentAttachment[];
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
}

export interface PaginatedDocuments {
  data: Document[];
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
}
