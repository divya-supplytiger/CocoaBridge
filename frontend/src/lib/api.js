import axiosInstance from "./axios.js";

// API functions to interact with the backend
export const dbApi = {
  // InboxItems
  listInboxItems: async (params) => {
    const { data } = await axiosInstance.get("/db/inbox-items", { params });
    return data;
  },
  getInboxItem: async (id) => {
    const { data } = await axiosInstance.get(`/db/inbox-items/${id}`);
    return data;
  },
  updateInboxItem: async (id, body) => {
    const { data } = await axiosInstance.patch(`/db/inbox-items/${id}`, body);
    return data;
  },
  deleteInboxItem: async (id) => {
    const { data } = await axiosInstance.delete(`/db/inbox-items/${id}`);
    return data;
  },
  // Opportunities
  listOpportunities: async (params) => {
    const { data } = await axiosInstance.get("/db/opportunities", { params });
    return data;
  },
  getOpportunity: async (id) => {
    const { data } = await axiosInstance.get(`/db/opportunities/${id}`);
    return data;
  },
  // Awards
  listAwards: async (params) => {
    const { data } = await axiosInstance.get("/db/awards", { params });
    return data;
  },
  getAward: async (id) => {
    const { data } = await axiosInstance.get(`/db/awards/${id}`);
    return data;
  },
  // Industry Days
  listIndustryDays: async (params) => {
    const { data } = await axiosInstance.get("/db/industry-days", { params });
    return data;
  },
  getIndustryDay: async (id) => {
    const { data } = await axiosInstance.get(`/db/industry-days/${id}`);
    return data;
  },
  updateIndustryDay: async (id, body) => {
    const { data } = await axiosInstance.patch(`/db/industry-days/${id}`, body);
    return data;
  },
  // Buying Orgs
  listBuyingOrgs: async (params) => {
    const { data } = await axiosInstance.get("/db/buying-orgs", { params });
    return data;
  },
  getBuyingOrg: async (id) => {
    const { data } = await axiosInstance.get(`/db/buying-orgs/${id}`);
    return data;
  },
};
