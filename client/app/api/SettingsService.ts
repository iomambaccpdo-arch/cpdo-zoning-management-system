import axiosInstance from "../lib/axios";

export interface Settings {
  number_of_days: number;
}

export class SettingsService {
  static async getSettings(): Promise<Settings> {
    const response = await axiosInstance.get<Settings>("/api/settings");
    return response.data;
  }
}
