import axios from "axios";

export const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api"
});

export async function processAlerts() {
  return (await api.post("/process")).data;
}

export async function getDashboard() {
  return (await api.get("/dashboard")).data;
}

export async function getIncidents() {
  return (await api.get("/incidents")).data;
}

export async function getIncident(id: string) {
  return (await api.get(`/incidents/${id}`)).data;
}

export async function analystAction(id: string, action: string) {
  return (await api.post(`/incidents/${id}/action`, { action })).data;
}
