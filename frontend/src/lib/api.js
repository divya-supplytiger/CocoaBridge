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
  createInboxItem: async (body) => {
    const { data } = await axiosInstance.post("/db/inbox-items", body);
    return data;
  },
  deleteInboxItem: async (id) => {
    const { data } = await axiosInstance.delete(`/db/inbox-items/${id}`);
    return data;
  },
  bulkDeleteInboxItems: (ids) => axiosInstance.delete("/db/inbox-items", { data: { ids } }),
  // Opportunities
  listOpportunities: async (params) => {
    const { data } = await axiosInstance.get("/db/opportunities", { params });
    return data;
  },
  getOpportunity: async (id) => {
    const { data } = await axiosInstance.get(`/db/opportunities/${id}`);
    return data;
  },
  deleteOpportunity: async (id) => {
    const { data } = await axiosInstance.delete(`/db/opportunities/${id}`);
    return data;
  },
  // Attachment parsing
  parseAttachment: async (id) => {
    const { data } = await axiosInstance.post(`/db/attachments/${id}/parse`);
    return data;
  },
  getAttachmentText: async (id) => {
    const { data } = await axiosInstance.get(`/db/attachments/${id}/text`);
    return data;
  },
  saveParsedAttachment: async (id, parsedText) => {
    const { data } = await axiosInstance.post(`/db/attachments/${id}/save-parsed`, { parsedText });
    return data;
  },
  deleteParsedAttachment: async (id) => {
    const { data } = await axiosInstance.delete(`/db/attachments/${id}/parsed`);
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
  deleteAward: async (id) => {
    const { data } = await axiosInstance.delete(`/db/awards/${id}`);
    return data;
  },
  // Calendar
  listCalendarEvents: async (params) => {
    const { data } = await axiosInstance.get("/db/calendar-events", { params });
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
  updateBuyingOrg: async (id, body) => {
    const { data } = await axiosInstance.patch(`/db/buying-orgs/${id}`, body);
    return data;
  },
  // Recipients
  listRecipients: async (params) => {
    const { data } = await axiosInstance.get("/db/recipients", { params });
    return data;
  },
  getRecipient: async (id) => {
    const { data } = await axiosInstance.get(`/db/recipients/${id}`);
    return data;
  },
  updateRecipient: async (id, body) => {
    const { data } = await axiosInstance.patch(`/db/recipients/${id}`, body);
    return data;
  },
  // Contacts
  listContacts: async (params) => {
    const { data } = await axiosInstance.get("/db/contacts", { params });
    return data;
  },
  getContact: async (id) => {
    const { data } = await axiosInstance.get(`/db/contacts/${id}`);
    return data;
  },
  updateContact: async (id, body) => {
    const { data } = await axiosInstance.patch(`/db/contacts/${id}`, body);
    return data;
  },
  deleteContact: async (id) => {
    const { data } = await axiosInstance.delete(`/db/contacts/${id}`);
    return data;
  },
  // FLIS Items
  listFLISItems: async (params) => {
    const { data } = await axiosInstance.get("/db/flis-items", { params });
    return data;
  },
  getFLISItem: async (id) => {
    const { data } = await axiosInstance.get(`/db/flis-items/${id}`);
    return data;
  },
  // Favorites
  listFavorites: async () => {
    const { data } = await axiosInstance.get("/db/favorites");
    return data;
  },
  toggleFavorite: async (entityType, entityId) => {
    const { data } = await axiosInstance.post("/db/favorites", { entityType, entityId });
    return data;
  },

  // Manual Scoring
  getManualScorePreview: async (id) => {
    const { data } = await axiosInstance.get(`/db/opportunities/${id}/manual-score/preview`);
    return data;
  },
  submitManualScore: async (id, signals) => {
    const { data } = await axiosInstance.post(`/db/opportunities/${id}/manual-score`, { signals });
    return data;
  },

  // Scoring Queue
  listScoringQueue: async (params) => {
    const { data } = await axiosInstance.get("/db/scoring-queue", { params });
    return data;
  },
  approveScoringQueueItem: async (id) => {
    const { data } = await axiosInstance.post(`/db/scoring-queue/${id}/approve`);
    return data;
  },
  dismissScoringQueueItem: async (id) => {
    const { data } = await axiosInstance.post(`/db/scoring-queue/${id}/dismiss`);
    return data;
  },

  // CSV Exports
  exportOpportunities: (params) => axiosInstance.get("/db/opportunities/export", { params, responseType: "blob" }),
  exportAwards: (params) => axiosInstance.get("/db/awards/export", { params, responseType: "blob" }),
  exportContacts: (params) => axiosInstance.get("/db/contacts/export", { params, responseType: "blob" }),
  exportInboxItems: (params) => axiosInstance.get("/db/inbox-items/export", { params, responseType: "blob" }),
};

export const analyticsApi = {
  getRecipients: async (params) => { const { data } = await axiosInstance.get("/db/analytics/recipients", { params }); return data; },
  getPsc:        async (params) => { const { data } = await axiosInstance.get("/db/analytics/psc",        { params }); return data; },
  getNaics:      async (params) => { const { data } = await axiosInstance.get("/db/analytics/naics",      { params }); return data; },
  getAgencies:   async (params) => { const { data } = await axiosInstance.get("/db/analytics/agencies",   { params }); return data; },
};

export const chatApi = {
  listConversations: async () => {
    const { data } = await axiosInstance.get("/chat/conversations");
    return data;
  },
  getMessages: async (conversationId) => {
    const { data } = await axiosInstance.get(`/chat/conversations/${conversationId}/messages`);
    return data;
  },
  deleteConversation: async (id) => {
    const { data } = await axiosInstance.delete(`/chat/conversations/${id}`);
    return data;
  },
  updateConversation: async (id, body) => {
    const { data } = await axiosInstance.patch(`/chat/conversations/${id}`, body);
    return data;
  },
  getModels: async () => {
    const { data } = await axiosInstance.get("/chat/models");
    return data;
  },
};

export const adminApi = {
  // Current authenticated user's DB profile (all roles)
  getCurrentUser: async () => {
    const { data } = await axiosInstance.get("/db/me");
    return data;
  },
  // User management (admin only)
  listUsers: async () => {
    const { data } = await axiosInstance.get("/admin/users");
    return data;
  },
  updateUser: async (id, body) => {
    const { data } = await axiosInstance.patch(`/admin/users/${id}`, body);
    return data;
  },
  // System health (admin only)
  getSystemHealth: async () => {
    const { data } = await axiosInstance.get("/admin/system-health");
    return data;
  },
  // Manual sync triggers (admin only)
  // type: "sam-opportunities" | "usaspending-awards" | "sam-descriptions" | "sam-industry-days"
  triggerSync: async (type) => {
    const { data } = await axiosInstance.post(`/admin/sync/${type}`);
    return data;
  },
  // DB stats (admin only)
  getDbStats: async () => {
    const { data } = await axiosInstance.get("/admin/stats");
    return data;
  },
  // Parsed Documents — OpportunityAttachment overview (admin only)
  getParsedDocumentStats: async () => {
    const { data } = await axiosInstance.get("/admin/parsed-documents/stats");
    return data;
  },
  listParsedDocuments: async (params) => {
    const { data } = await axiosInstance.get("/admin/parsed-documents", { params });
    return data;
  },
  // Filter configuration (admin only)
  getFilterConfig: async () => {
    const { data } = await axiosInstance.get("/admin/config");
    return data;
  },
  getPublicConfig: async () => {
    const { data } = await axiosInstance.get("/admin/config/public");
    return data;
  },
  updateFilterConfig: async (key, values) => {
    const { data } = await axiosInstance.put(`/admin/config/${key}`, { values });
    return data;
  },
};
