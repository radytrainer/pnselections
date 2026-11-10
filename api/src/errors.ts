import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Record") => new HttpError(404, `${what} not found`);
export const forbidden = (message = "Forbidden") => new HttpError(403, message);
export const badRequest = (message: string) => new HttpError(400, message);

type PgError = Error & { code?: string; detail?: string };

/** Postgres SQLSTATE -> HTTP status, so RLS/constraint failures read like they did from PostgREST. */
const PG_STATUS: Record<string, number> = {
  "42501": 403, // insufficient_privilege / RLS violation
  "23505": 409, // unique_violation
  "23503": 409, // foreign_key_violation
  "23514": 400, // check_violation
  "23502": 400, // not_null_violation
  "22P02": 400, // invalid_text_representation (e.g. bad uuid)
  "22007": 400, // invalid_datetime_format
  "22008": 400, // datetime_field_overflow
  "22003": 400, // numeric_value_out_of_range
  P0001: 400, // raise exception (trigger guards)
};

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, ...error.details });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const pgError = error as PgError;
  if (pgError && typeof pgError.code === "string" && PG_STATUS[pgError.code]) {
    res.status(PG_STATUS[pgError.code]).json({ error: pgError.message, code: pgError.code });
    return;
  }
  // multer limit errors
  if (pgError && (pgError as { name?: string }).name === "MulterError") {
    res.status(400).json({ error: pgError.message });
    return;
  }

  console.error(`[api] ${req.method} ${req.originalUrl} failed`, error);
  res.status(500).json({ error: "Internal server error" });
}
