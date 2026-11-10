import type { Request } from "express";
import { badRequest } from "../errors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Single string query param, or undefined when missing/empty. */
export function qs(req: Request, name: string): string | undefined {
  const value = req.query[name];
  if (typeof value === "string" && value !== "") return value;
  return undefined;
}

export function uuidParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || !UUID_RE.test(value)) throw badRequest(`Invalid ${name}`);
  return value;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Collects positional SQL params and hands back their `$n` placeholder. */
export class Params {
  readonly values: unknown[] = [];
  add(value: unknown) {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

/** `(select json_build_object(...) from <table> x where x.id = <fk>)` — a PostgREST-style to-one embed. */
export function toOne(table: string, alias: string, fields: string[], on: string, as: string) {
  const obj = fields.map((f) => `'${f}', ${alias}.${f}`).join(", ");
  return `(select json_build_object(${obj}) from ${table} ${alias} where ${on}) as ${as}`;
}

/** `coalesce((select json_agg(...) ...), '[]')` — a PostgREST-style to-many embed. */
export function toMany(table: string, alias: string, fields: string[] | "*", on: string, as: string) {
  const obj = fields === "*" ? `row_to_json(${alias})` : `json_build_object(${fields.map((f) => `'${f}', ${alias}.${f}`).join(", ")})`;
  return `coalesce((select json_agg(${obj}) from ${table} ${alias} where ${on}), '[]'::json) as ${as}`;
}
