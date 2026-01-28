/**
 * Unit Tests for Response Handler Utility
 * Tests LO2: Code Instrumentation & LO3: Unit Testing
 *
 * Purpose: Validate standardized response formatting
 */

const ResponseHandler = require("../../src/utils/responseHandler");

describe("ResponseHandler Utility - Unit Tests", () => {
  let mockRes;

  beforeEach(() => {
    // Mock Express response object
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe("Success Response", () => {
    test("should send success response with message only", () => {
      ResponseHandler.success(mockRes, 200, "Operation successful");

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Operation successful",
      });
    });

    test("should send success response with message and data", () => {
      const data = { id: "123", name: "Test User" };
      ResponseHandler.success(mockRes, 201, "User created", data);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "User created",
        data: data,
      });
    });

    test("should handle various success status codes", () => {
      const statusCodes = [200, 201, 202, 204];

      statusCodes.forEach((code) => {
        mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        };

        ResponseHandler.success(mockRes, code, "Success");
        expect(mockRes.status).toHaveBeenCalledWith(code);
      });
    });

    test("should handle null data parameter", () => {
      ResponseHandler.success(mockRes, 200, "Success", null);

      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Success",
      });
    });

    test("should handle undefined data parameter", () => {
      ResponseHandler.success(mockRes, 200, "Success", undefined);

      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Success",
      });
    });

    test("should handle complex data objects", () => {
      const complexData = {
        users: [{ id: 1 }, { id: 2 }],
        metadata: { total: 2, page: 1 },
        nested: { deep: { value: "test" } },
      };

      ResponseHandler.success(mockRes, 200, "Data retrieved", complexData);

      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Data retrieved",
        data: complexData,
      });
    });

    test("should handle array data", () => {
      const arrayData = [1, 2, 3, 4, 5];
      ResponseHandler.success(mockRes, 200, "Items found", arrayData);

      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Items found",
        data: arrayData,
      });
    });
  });

  describe("Error Response", () => {
    test("should send error response with message", () => {
      ResponseHandler.error(mockRes, 400, "Bad request");

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Bad request",
      });
    });

    test("should handle various error status codes", () => {
      const errorCodes = [400, 401, 403, 404, 500];

      errorCodes.forEach((code) => {
        mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        };

        ResponseHandler.error(mockRes, code, "Error occurred");
        expect(mockRes.status).toHaveBeenCalledWith(code);
      });
    });

    test("should handle authentication errors", () => {
      ResponseHandler.error(mockRes, 401, "Unauthorized");

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Unauthorized",
      });
    });

    test("should handle forbidden errors", () => {
      ResponseHandler.error(mockRes, 403, "Forbidden");

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Forbidden",
      });
    });

    test("should handle server errors", () => {
      ResponseHandler.error(mockRes, 500, "Internal server error");

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("Method Chaining", () => {
    test("should support method chaining for success", () => {
      const result = ResponseHandler.success(mockRes, 200, "Success");

      expect(result).toBe(mockRes);
    });

    test("should support method chaining for error", () => {
      const result = ResponseHandler.error(mockRes, 400, "Error");

      expect(result).toBe(mockRes);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty message string", () => {
      ResponseHandler.success(mockRes, 200, "");

      expect(mockRes.json).toHaveBeenCalledWith({
        message: "",
      });
    });

    test("should handle very long messages", () => {
      const longMessage = "A".repeat(1000);
      ResponseHandler.error(mockRes, 400, longMessage);

      expect(mockRes.json).toHaveBeenCalledWith({
        message: longMessage,
      });
    });

    test("should handle special characters in message", () => {
      const specialMessage = 'Error: "value" must be <valid> & not null';
      ResponseHandler.error(mockRes, 400, specialMessage);

      expect(mockRes.json).toHaveBeenCalledWith({
        message: specialMessage,
      });
    });

    test("should handle numeric message", () => {
      ResponseHandler.success(mockRes, 200, 123);

      expect(mockRes.json).toHaveBeenCalledWith({
        message: 123,
      });
    });
  });

  describe("Integration with Express", () => {
    test("should call response methods in correct order", () => {
      const callOrder = [];
      mockRes.status = jest.fn((code) => {
        callOrder.push("status");
        return mockRes;
      });
      mockRes.json = jest.fn((data) => {
        callOrder.push("json");
        return mockRes;
      });

      ResponseHandler.success(mockRes, 200, "Success");

      expect(callOrder).toEqual(["status", "json"]);
    });
  });

  describe("Module Structure", () => {
    test("should be a class/function", () => {
      expect(typeof ResponseHandler).toBe("function");
    });

    test("should have success method", () => {
      expect(ResponseHandler.success).toBeDefined();
    });

    test("should have error method", () => {
      expect(ResponseHandler.error).toBeDefined();
    });

    test("success should be a function", () => {
      expect(typeof ResponseHandler.success).toBe("function");
    });

    test("error should be a function", () => {
      expect(typeof ResponseHandler.error).toBe("function");
    });

    test("should not throw on success call", () => {
      expect(() => ResponseHandler.success(mockRes, 200, "test")).not.toThrow();
    });

    test("should not throw on error call", () => {
      expect(() => ResponseHandler.error(mockRes, 400, "test")).not.toThrow();
    });

    test("should call status method", () => {
      ResponseHandler.success(mockRes, 200, "test");
      expect(mockRes.status).toHaveBeenCalled();
    });
  });
});
