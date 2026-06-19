import axiosInstance from "../lib/axios";

export interface SpecificProjectType {
  id: number;
  project_type_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectType {
  id: number;
  zoning_id: number;
  name: string;
  created_at: string;
  updated_at: string;
  specific_project_types: SpecificProjectType[];
}

export interface Zoning {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  project_types: ProjectType[];
}

export class ZoningService {
  static async getZonings(): Promise<Zoning[]> {
    const response = await axiosInstance.get<Zoning[]>("/api/zonings");
    return response.data;
  }
}
