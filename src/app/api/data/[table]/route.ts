import { NextRequest, NextResponse } from "next/server";
import { getTable, mutateTable, DatabaseSchema } from "@/lib/auth/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const { table } = await params;
    const url = new URL(req.url);
    const tableName = table as keyof DatabaseSchema;

    let rows = getTable(tableName);

    // Apply equality filters from query params
    url.searchParams.forEach((val, key) => {
      if (key !== "order" && key !== "ascending" && key !== "limit" && key !== "single") {
        rows = rows.filter((r) => String(r[key] ?? "") === String(val));
      }
    });

    // Order
    const orderField = url.searchParams.get("order");
    const ascending = url.searchParams.get("ascending") !== "false";
    if (orderField) {
      rows = [...rows].sort((a, b) => {
        const valA = a[orderField];
        const valB = b[orderField];
        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
      });
    }

    // Limit
    const limit = url.searchParams.get("limit");
    if (limit) {
      rows = rows.slice(0, parseInt(limit, 10));
    }

    // Single
    const single = url.searchParams.get("single") === "true";
    if (single) {
      return NextResponse.json(rows[0] || null);
    }

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const { table } = await params;
    const tableName = table as keyof DatabaseSchema;
    const body = await req.json();

    const newRows = Array.isArray(body) ? body : [body];
    const insertedItems: Array<Record<string, any>> = [];

    mutateTable(tableName, (current) => {
      newRows.forEach((item) => {
        const withId = {
          id: item.id || Date.now() + Math.floor(Math.random() * 1000),
          created_at: item.created_at || new Date().toISOString(),
          ...item,
        };
        insertedItems.push(withId);
        current.push(withId);
      });
      return current;
    });

    return NextResponse.json(Array.isArray(body) ? insertedItems : insertedItems[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const { table } = await params;
    const tableName = table as keyof DatabaseSchema;
    const url = new URL(req.url);
    const body = await req.json();

    const eqKey = url.searchParams.get("eqKey");
    const eqVal = url.searchParams.get("eqVal");

    let updatedCount = 0;
    mutateTable(tableName, (current) => {
      return current.map((item) => {
        if (eqKey && String(item[eqKey]) === String(eqVal)) {
          updatedCount++;
          return { ...item, ...body, updated_at: new Date().toISOString() };
        }
        return item;
      });
    });

    return NextResponse.json({ success: true, updated: updatedCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    const { table } = await params;
    const tableName = table as keyof DatabaseSchema;
    const url = new URL(req.url);

    const eqKey = url.searchParams.get("eqKey");
    const eqVal = url.searchParams.get("eqVal");

    mutateTable(tableName, (current) => {
      if (!eqKey) return current;
      return current.filter((item) => String(item[eqKey]) !== String(eqVal));
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
