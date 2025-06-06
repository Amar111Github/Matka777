import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";



const errorHandler = (err, req, res, next) => {

  console.error('Caught an error:', err);

  if (err instanceof ApiError) {
    // Handle ApiError specifically
    return res.status(err.statusCode).json(new ApiResponse(err.statusCode, null, err.message, false));
  } else {
    // Handle other errors
    return res.status(500).json(new ApiResponse(500, null, 'Internal Server Error', false));
  }
}
export { errorHandler };