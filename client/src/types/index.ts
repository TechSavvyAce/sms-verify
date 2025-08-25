// 用户相关类型
export interface User {
  id: number;
  username: string;
  email: string;
  phone?: string;
  verification_method?: "email" | "sms";
  balance: number;
  total_spent: number;
  total_recharged: number;
  status: "active" | "suspended" | "pending";
  created_at: string;
  updated_at: string;
  last_login?: string;
  login_count: number;
  password_hash?: string;
}

// 认证相关类型
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface RegisterResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  verification_methods: string[]; // 支持的验证方式
  verification_method?: "email" | "sms";
  verification_data?: {
    email?: string;
    phone?: string;
  };
}

// 服务相关类型
export interface Service {
  key: string;
  name: string;
  available: number;
  popular: boolean;
  description?: string;
  category?: string;
  success_rate?: number;
  avg_price?: number;
}

export interface Country {
  id: number;
  name: string;
  code: string;
  flag: string;
  available: number;
  recommended: boolean;
}

export interface ServicePricing {
  original: number;
  final: number;
  markup: number;
  currency: string;
  markup_percent: number;
  available: number;
  recommended: boolean;
}

// 激活相关类型
export interface Activation {
  id: number;
  activation_id: string;
  service: string;
  service_name: string;
  country_id: number;
  country_name: string;
  phone_number?: string;
  cost: number;
  status: "0" | "1" | "3" | "6" | "8";
  status_text: string;
  sms_code?: string;
  expires_at: string;
  last_check_at?: string;
  check_count: number;
  created_at: string;
  can_cancel: boolean;
  is_expired: boolean;
  is_completed: boolean;
  is_freeprice?: boolean;
  max_price?: number;
  actual_cost?: number;
  currency?: number;
  operator?: string;
}

export interface CreateActivationRequest {
  service: string;
  country: number;
  operator?: string;
  forward?: number; // 是否需要转发 (0=否, 1=是)
  ref?: string; // 推荐ID
  phoneException?: string; // 排除的号码前缀
  activationType?: number; // 激活类型 (0=SMS, 1=号码, 2=语音)
  language?: string; // 语言
  userId?: string; // 用户ID
}

export interface CreateActivationFreePriceRequest extends CreateActivationRequest {
  maxPrice: number;
}

// 租用相关类型
export interface Rental {
  id: number;
  rental_id: string;
  service: string;
  service_name: string;
  country_id: number;
  country_name: string;
  phone_number?: string;
  cost: number;
  duration_hours: number;
  status: "active" | "expired" | "cancelled";
  status_text: string;
  expires_at: string;
  remaining_hours: number;
  sms_count: number;
  sms_received?: SMSMessage[];
  last_check_at?: string;
  created_at: string;
  can_cancel: boolean;
  is_expired: boolean;
}

export interface CreateRentalRequest {
  service: string;
  time: number;
  country: number;
  operator?: string;
}

export interface SMSMessage {
  sender: string;
  message: string;
  time: string;
  received_at: string;
}

// 交易相关类型
export interface Transaction {
  id: number;
  user_id?: number;
  type: "recharge" | "activation" | "rental" | "refund" | "adjustment";
  type_display?: string;
  amount: number;
  balance_before?: number;
  balance_after?: number;
  reference_id?: string;
  description?: string;
  created_at: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?:
    | string
    | {
        message: string;
        code?: string;
        statusCode?: number;
        timestamp?: string;
        stack?: string;
        details?: any;
      };
  data?: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// 统计相关类型
export interface UserStats {
  activations: Record<string, { count: number; total_cost: number }>;
  rentals: Record<string, { count: number; total_cost: number }>;
  transactions: Record<string, { count: number; total_amount: number }>;
  recent_activity: Array<{
    date: string;
    count: number;
    amount: number;
  }>;
}

export interface SystemStats {
  period_days: number;
  users: {
    total: number;
    by_status: Record<string, number>;
    new_registrations: number;
  };
  activations: {
    total: number;
    by_status: Record<string, { count: number; total_cost: number }>;
  };
  rentals: {
    total: number;
    by_status: Record<string, { count: number; total_cost: number }>;
  };
  financial: {
    total_revenue: number;
    total_refunds: number;
    net_revenue: number;
    transactions_by_type: Record<string, { count: number; total_amount: number }>;
  };
}

// 配置相关类型
export interface AppConfig {
  api_base_url: string;
  websocket_url: string;
  price_currency: string;
  supported_languages: string[];
  contact_email: string;
  max_activations_per_day: number;
  max_rentals_per_day: number;
}

// 状态管理相关类型
export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initializeAuth: () => Promise<void>;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<RegisterResponse | undefined>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  updateBalance: (changeAmount: number, newBalance?: number) => void;
}

export interface AppState {
  services: Service[];
  countries: Record<string, Country[]>;
  pricing: Record<string, Record<string, ServicePricing>>;
  activations: Activation[];
  rentals: Rental[];
  transactions: Transaction[];
  stats: UserStats | null;
  isLoading: boolean;
  error: string | null;
}

// 表单相关类型
export interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "number" | "select" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: any }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

// 通知相关类型
export interface NotificationConfig {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  duration?: number;
  placement?: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
}

// WebSocket相关类型
export interface WebSocketMessage {
  type:
    | "activation_created"
    | "activation_updated"
    | "activation_cancelled"
    | "rental_created"
    | "rental_sms_received"
    | "rental_cancelled"
    | "rental_extended"
    | "balance_updated";
  data: any;
  timestamp: string;
}

// 路由相关类型
export interface RouteConfig {
  path: string;
  component: React.ComponentType;
  title: string;
  icon?: string;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  hidden?: boolean;
  children?: RouteConfig[];
}

// 搜索和过滤相关类型
export interface SearchFilters {
  query?: string;
  service?: string;
  country?: number;
  status?: string;
  date_range?: [string, string];
  sort?: string;
  order?: "asc" | "desc";
}

export interface TableColumn {
  key: string;
  title: string;
  dataIndex?: string;
  width?: number;
  fixed?: "left" | "right";
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, record: any, index: number) => React.ReactNode;
}

// 主题相关类型
export interface ThemeConfig {
  primaryColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  backgroundColor: string;
  cardBackground: string;
  textColor: string;
  borderColor: string;
  borderRadius: number;
  fontSize: number;
  spacing: number;
}

// 错误相关类型
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// 导出所有类型的联合类型
export type ServiceStatus = Activation["status"] | Rental["status"];
export type TransactionType = Transaction["type"];
export type UserStatus = User["status"];
export type NotificationType = NotificationConfig["type"];
