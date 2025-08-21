/**
 * Helper function to safely extract error message from API response
 */
export const getErrorMessage = (error: any, defaultMessage: string = "操作失败"): string => {
  if (!error) return defaultMessage;

  // If error is a string, return it directly
  if (typeof error === "string") {
    return error;
  }

  // If error is an object with a message property
  if (typeof error === "object" && error.message) {
    return error.message;
  }

  // If error has a nested error property
  if (error.error) {
    return getErrorMessage(error.error, defaultMessage);
  }

  // If error has response.data.error structure (axios error)
  if (error.response?.data?.error) {
    return getErrorMessage(error.response.data.error, defaultMessage);
  }

  // If error has response.data.message structure
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  // Default message
  return defaultMessage;
};

/**
 * Helper function to get error message from API response
 */
export const getApiErrorMessage = (
  error: string | { message: string; code?: string; statusCode?: number } | undefined,
  defaultMessage: string = "操作失败"
): string => {
  if (!error) return defaultMessage;

  if (typeof error === "string") {
    return error;
  }

  return error.message || defaultMessage;
};
