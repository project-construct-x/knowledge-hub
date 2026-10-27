import type {
  UseCase,
  SubUseCase,
  Role,
  Transaction,
  TransactionMutate,
  UseCaseCreate,
  SubUseCaseCreate,
  Property,
  PropertyGroup,
  ClassWithProperties,
  User,
  UserCreate,
  UserUpdate,
  APIKey,
  APIKeyCreate,
  Token,
  OntologyEdge,
  OntologyNode,
  Standard,
  VersionInfo
} from "../types.ts";

export const BASE = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(`HTTP ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  // Token oder API-Key aus localStorage holen
  const token = localStorage.getItem('access_token');
  const apiKey = localStorage.getItem('api_key');

  // Headers mit Authorization erweitern
  const headers = new Headers(opts.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else if (apiKey) {
    headers.set('X-API-Key', apiKey);
  }

  const res = await fetch(`${BASE}${path}`, {...opts, headers});

  if (!res.ok) {
    // Attempt automatic token refresh on 401
    if (res.status === 401) {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const newTokens = await api.refreshToken(refresh);
          // Update stored tokens
          localStorage.setItem('access_token', newTokens.access_token);
          if (newTokens.refresh_token) localStorage.setItem('refresh_token', newTokens.refresh_token);
          if (newTokens.id_token) localStorage.setItem('id_token', newTokens.id_token);
          // Retry the original request with new access token
          const retryHeaders = new Headers(opts.headers);
          retryHeaders.set('Authorization', `Bearer ${newTokens.access_token}`);
          const retryRes = await fetch(`${BASE}${path}`, {...opts, headers: retryHeaders});
          if (retryRes.ok) {
            if (retryRes.status === 204) return null as T;
            return retryRes.json() as Promise<T>;
          }
          // If retry also fails, fall through to error handling below
          let retryDetail: unknown;
          try {
            retryDetail = await retryRes.json();
          } catch {
            retryDetail = await retryRes.text();
          }
          throw new ApiError(retryRes.status, retryDetail);
        } catch (refreshErr) {
          // Refresh failed – proceed to original error handling
          console.error('Token refresh failed:', refreshErr);
        }
      }
    }
    // Original error handling
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export const api = {
  // ---Auth---
  login: (username: string, password: string) => {
      // existing login remains
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    return request<Token>("/token", {
      method: "POST",
      body: formData,
    });
  },
  // Refresh token using stored refresh token
  refreshToken: (refreshToken: string) =>
      request<{ access_token: string; refresh_token: string; id_token: string }>("/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
          headers: { "Content-Type": "application/json" },
      }),

  register: (data: UserCreate) =>
    request<User>("/register", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"}
    }),

  getCurrentUser: () => request<User>("/users/me"),

  // ---Users---
  listUsers: () => request<User[]>("/users/"),

  updateUser: (id: number, data: UserUpdate) =>
    request<User>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),

  deleteUser: (id: number) =>
    request<void>(`/users/${id}`, {method: "DELETE"}),

  // ---API Keys---
  listAPIKeys: () => request<APIKey[]>("/api-keys"),

  createAPIKey: (data: APIKeyCreate) =>
    request<APIKey>("api-keys", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),

  deleteAPIKey: (id: number) =>
    request<void>(`/api-keys/${id}`, {method: "DELETE"}),

  // ---UseCases---
  listUseCases: () => request<UseCase[]>("/usecases/"),
  getUseCase: (id: number) => request<UseCase>(`/usecases/${id}`),
  getUseCaseVersion: (id: number) => request<VersionInfo>(`/usecases/${id}/version`),
  createUseCase: (data: UseCaseCreate) =>
    request<UseCase>("/usecases/", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  updateUseCase: (id: number, data: Partial<UseCaseCreate>) =>
    request<UseCase>(`/usecases/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  deleteUseCase: (id: number) =>
    request<void>(`/usecases/${id}`, {method: "DELETE"}),

  // ---SubUseCases---
  listSubUseCases: () => request<SubUseCase[]>("/subusecases/"),
  listSubUseCasesByRole: (roleId: number) =>
    request<SubUseCase[]>(`/subusecases/by-role/${roleId}`),
  getSubUseCase: (id: number) => request<SubUseCase>(`/subusecases/${id}`),
  getSubUseCaseVersion: (id: number) => request<VersionInfo>(`/subusecases/${id}/version`),
  createSubUseCase: (data: Partial<SubUseCaseCreate>) =>
    request<SubUseCase>("/subusecases/", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  updateSubUseCase: (id: number, data: Partial<SubUseCaseCreate>) =>
    request<SubUseCase>(`/subusecases/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  deleteSubUseCase: (id: number) =>
    request<void>(`/subusecases/${id}`, {method: "DELETE"}),
  updateSubUseCaseBPMNXML: (id: number, bpmn_xml: string) => {
    request<SubUseCase>(`/subusecases/${id}/bpmn-xml`, {
      method: "PUT",
      body: JSON.stringify({bpmn_xml}),
      headers: {"Content-Type": "application/json"},
    })
  },

  // ---Roles---
  listRoles: () => request<Role[]>("/roles/"),
  getRole: (id: number) => request<Role>(`/roles/${id}`),
  getRoleVersion: (id: number) => request<VersionInfo>(`/roles/${id}/version`),
  createRole: (data: Partial<Role>) =>
    request<Role>("/roles/", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  updateRole: (id: number, data: Partial<Role>) =>
    request<Role>(`/roles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  deleteRole: (id: number) =>
    request<void>(`/roles/${id}`, {method: "DELETE"}),

  // ---Standards---
  listStandards: () => request<Standard[]>("/standards/"),
  getStandard: (id: number) => request<Standard>(`/standards/${id}`),
  getStandardVersion: (id: number) => request<VersionInfo>(`/standards/${id}/version`),
  createStandard: (data: Partial<Standard>) =>
    request<Standard>("/standards/", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  updateStandard: (id: number, data: Partial<Standard>) =>
    request<Standard>(`/standards/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  deleteStandard: (id: number) =>
    request<void>(`/standards/${id}`, {method: "DELETE"}),

  // ---Transactions---
  listTransactions: () => request<Transaction[]>("/transactions/"),
  listTransactionsBySubUseCase: (subId: number) =>
    request<Transaction[]>(`/transactions/by-subusecase/${subId}`),
  getTransaction: (id: number) => request<Transaction>(`/transactions/${id}`),
  getTransactionVersion: (id: number) => request<VersionInfo>(`/transactions/${id}/version`),
  createTransaction: (data: TransactionMutate) =>
    request<Transaction>("/transactions/", {
      method: "POST",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  updateTransaction: (id: number, data: TransactionMutate) =>
    request<Transaction>(`/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  deleteTransaction: (id: number) =>
    request<void>(`/transactions/${id}`, {method: "DELETE"}),

  // ---Properties---
  listProperties: () => request<Property[]>("/properties/"),
  getPropertiesByGroup: (group_uuid: string) => request<Property[]>(`/properties/by-group/${group_uuid}`),
  getProperty: (uuid: string) => request<Property>(`/properties/${uuid}`),
  getPropertyVersion: (uuid: string) => request<VersionInfo>(`/properties/${uuid}/version`),
  createProperty: (data: Partial<Property>) =>
    request<Property>(`/properties/`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  updateProperty: (uuid: string, data: Partial<Property>) =>
    request<Property>(`/properties/${uuid}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  deleteProperty: (uuid: string) =>
    request<void>(`/properties/${uuid}`, {method: "DELETE"}),

  // ---Property Groups---
  listPropertyGroups: () => request<PropertyGroup[]>("/propertygroups/"),
  listPropertyGroupsByCategory: (category: string) => request<PropertyGroup[]>(`/propertygroups/category/${category}`),
  getClassPropertyTree: () => request<ClassWithProperties[]>("/propertygroups/class-property-tree/"),
  getPropertyGroup: (uuid: string) => request<PropertyGroup>(`/propertygroups/${uuid}`),
  getPropertyGroupVersion: (uuid: string) => request<VersionInfo>(`/propertygroups/${uuid}/version`),
  createPropertyGroup: (data: Partial<PropertyGroup>) =>
    request<PropertyGroup>(`/propertygroups/`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  updatePropertyGroup: (uuid: string, data: Partial<PropertyGroup>) =>
    request<PropertyGroup>(`/propertygroups/${uuid}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: {"Content-Type": "application/json"},
    }),
  deletePropertyGroup: (uuid: string) =>
    request<void>(`/propertygroups/${uuid}`, {method: "DELETE"}),

  // ---Ontology---
  getOntologyGraph: () =>
    request<{ nodes: OntologyNode[]; edges: OntologyEdge[] }>("/ontology/graph")
}