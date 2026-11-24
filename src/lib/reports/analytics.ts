import { Prisma } from "@/generated/prisma/client";
import type { OrderSource, OrderStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  getDhakaDate,
  getNextDhakaDate,
  getPreviousDhakaDate,
  type DhakaDateRange,
} from "./date-range";

type OrderWhere = Prisma.OrderWhereInput;

const bookedStatuses: OrderStatus[] = ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"];
const estimatedStatuses: OrderStatus[] = [
  "PENDING",
  "AWAITING_PAYMENT",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
];

function sumForStatuses(statuses: OrderStatus[], selectedStatus?: OrderStatus): OrderWhere {
  if (selectedStatus) return { status: statuses.includes(selectedStatus) ? selectedStatus : { in: [] } };
  return { status: { in: statuses } };
}

function orderDateWhere(range: DhakaDateRange, status?: OrderStatus): OrderWhere {
  return {
    createdAt: { gte: range.startsAt, lt: range.endsBefore },
    ...(status ? { status } : {}),
  };
}

async function orderSum(where: OrderWhere) {
  const result = await getPrisma().order.aggregate({
    where,
    _sum: { total: true },
  });
  return result._sum.total?.toFixed(2) ?? "0.00";
}

function getCalendarDays(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const result: string[] = [];
  for (let timestamp = Date.UTC(fromYear, fromMonth - 1, fromDay);
    timestamp <= Date.UTC(toYear, toMonth - 1, toDay);
    timestamp += 86_400_000) {
    result.push(new Date(timestamp).toISOString().slice(0, 10));
  }
  return result;
}

function emptyHours() {
  return Array.from({ length: 24 }, () => 0);
}

export async function getDashboardAnalytics(input: {
  range: DhakaDateRange;
  status?: OrderStatus;
}) {
  const prisma = getPrisma();
  const { range, status } = input;
  const baseWhere = orderDateWhere(range, status);
  const bookedWhere = {
    createdAt: baseWhere.createdAt,
    ...sumForStatuses(bookedStatuses, status),
  } satisfies OrderWhere;
  const estimateWhere = {
    createdAt: baseWhere.createdAt,
    ...sumForStatuses(estimatedStatuses, status),
  } satisfies OrderWhere;
  const deliveredWhere = {
    createdAt: baseWhere.createdAt,
    ...sumForStatuses(["DELIVERED"], status),
  } satisfies OrderWhere;

  const [orderCount, bookedSales, deliveredSales, estimate, sourceRows, pendingOrders, failedBookings, unsettledCod] =
    await Promise.all([
      prisma.order.count({ where: baseWhere }),
      orderSum(bookedWhere),
      orderSum(deliveredWhere),
      orderSum(estimateWhere),
      prisma.order.groupBy({
        by: ["source"],
        where: baseWhere,
        _count: { _all: true },
        _sum: { total: true },
        orderBy: { source: "asc" },
      }),
      prisma.order.count({ where: { status: { in: ["PENDING", "AWAITING_PAYMENT"] } } }),
      prisma.courierBooking.count({ where: { status: "FAILED" } }),
      prisma.courierBooking.count({
        where: {
          status: "DELIVERED",
          settlement: { is: null },
          order: { is: { status: "DELIVERED", paymentMethod: "COD" } },
        },
      }),
    ]);

  const statusCondition = status
    ? Prisma.sql`AND o.status = ${status}::"OrderStatus"`
    : Prisma.empty;
  const [placedByDay, shippedByDay] = await Promise.all([
    prisma.$queryRaw<Array<{ day: string; total: number }>>(Prisma.sql`
      SELECT to_char(o.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS total
      FROM orders o
      WHERE o.created_at >= ${range.startsAt} AND o.created_at < ${range.endsBefore}
        ${statusCondition}
      GROUP BY day
      ORDER BY day
    `),
    prisma.$queryRaw<Array<{ day: string; total: number }>>(Prisma.sql`
      SELECT to_char(h.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS total
      FROM order_status_history h
      INNER JOIN orders o ON o.id = h.order_id
      WHERE h.created_at >= ${range.startsAt} AND h.created_at < ${range.endsBefore}
        AND h.to_status IN ('SHIPPED'::"OrderStatus", 'DELIVERED'::"OrderStatus")
        ${statusCondition}
      GROUP BY day
      ORDER BY day
    `),
  ]);
  const placedByDate = new Map(placedByDay.map((row) => [row.day, row.total]));
  const shippedByDate = new Map(shippedByDay.map((row) => [row.day, row.total]));
  const volume = getCalendarDays(range.from, range.to).map((day) => ({
    day,
    placed: placedByDate.get(day) ?? 0,
    shippedDelivered: shippedByDate.get(day) ?? 0,
  }));

  const today = getDhakaDate();
  const yesterday = getPreviousDhakaDate(today);
  const todayStart = new Date(`${today}T00:00:00.000+06:00`);
  const dayAfterToday = new Date(`${getNextDhakaDate(today)}T00:00:00.000+06:00`);
  const yesterdayStart = new Date(`${yesterday}T00:00:00.000+06:00`);
  const hourlyStatusCondition = status
    ? Prisma.sql`AND status = ${status}::"OrderStatus"`
    : Prisma.empty;
  const [todayHours, yesterdayHours] = await Promise.all([
    prisma.$queryRaw<Array<{ hour: number; total: number }>>(Prisma.sql`
      SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Dhaka')::int AS hour,
             COUNT(*)::int AS total
      FROM orders
      WHERE source = 'WEB'::"OrderSource"
        AND created_at >= ${todayStart} AND created_at < ${dayAfterToday}
        ${hourlyStatusCondition}
      GROUP BY hour
    `),
    prisma.$queryRaw<Array<{ hour: number; total: number }>>(Prisma.sql`
      SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Dhaka')::int AS hour,
             COUNT(*)::int AS total
      FROM orders
      WHERE source = 'WEB'::"OrderSource"
        AND created_at >= ${yesterdayStart} AND created_at < ${todayStart}
        ${hourlyStatusCondition}
      GROUP BY hour
    `),
  ]);
  const todayHourly = emptyHours();
  const yesterdayHourly = emptyHours();
  for (const row of todayHours) todayHourly[row.hour] = row.total;
  for (const row of yesterdayHours) yesterdayHourly[row.hour] = row.total;

  return {
    metrics: {
      orders: orderCount,
      bookedSales,
      deliveredSales,
      estimate,
    },
    attention: {
      pendingOrders,
      failedBookings,
      unsettledCod,
      allCaughtUp: pendingOrders + failedBookings + unsettledCod === 0,
    },
    volume,
    hourly: { today: todayHourly, yesterday: yesterdayHourly },
    sources: sourceRows.map((row) => ({
      source: row.source as OrderSource,
      orders: row._count._all,
      total: row._sum.total?.toFixed(2) ?? "0.00",
    })),
    usage: await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.warehouse.count({ where: { isActive: true } }),
    ]).then(([products, staff, warehouses]) => ({ products, staff, warehouses })),
  };
}

export async function getProfitReport(range: DhakaDateRange) {
  const prisma = getPrisma();
  const [delivered, otherIncome, expenses] = await Promise.all([
    prisma.orderStatusHistory.findMany({
      where: {
        toStatus: "DELIVERED",
        createdAt: { gte: range.startsAt, lt: range.endsBefore },
        order: { status: "DELIVERED" },
      },
      select: {
        order: {
          select: {
            total: true,
            items: {
              select: {
                quantity: true,
                product: { select: { type: true } },
                batches: {
                  select: { quantity: true, batch: { select: { unitCost: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.accountingTransaction.aggregate({
      where: {
        type: "INCOME",
        courierSettlementId: null,
        occurredAt: { gte: range.startsAt, lt: range.endsBefore },
      },
      _sum: { amount: true },
    }),
    prisma.accountingTransaction.aggregate({
      where: {
        type: "EXPENSE",
        occurredAt: { gte: range.startsAt, lt: range.endsBefore },
      },
      _sum: { amount: true },
    }),
  ]);

  const sales = delivered.reduce(
    (sum, entry) => sum.plus(entry.order.total),
    new Prisma.Decimal(0),
  );
  let costOfGoods = new Prisma.Decimal(0);
  let uncostedPhysicalItems = 0;
  for (const entry of delivered) {
    for (const item of entry.order.items) {
      if (item.product.type !== "PHYSICAL") continue;
      const allocatedQuantity = item.batches.reduce((sum, allocation) => sum + allocation.quantity, 0);
      if (allocatedQuantity < item.quantity) uncostedPhysicalItems += item.quantity - allocatedQuantity;
      for (const allocation of item.batches) {
        costOfGoods = costOfGoods.plus(allocation.batch.unitCost.mul(allocation.quantity));
      }
    }
  }
  const grossProfit = sales.minus(costOfGoods);
  const income = otherIncome._sum.amount ?? new Prisma.Decimal(0);
  const expense = expenses._sum.amount ?? new Prisma.Decimal(0);
  const netProfit = grossProfit.plus(income).minus(expense);

  return {
    deliveredSales: sales.toFixed(2),
    costOfGoods: costOfGoods.toFixed(2),
    grossProfit: grossProfit.toFixed(2),
    grossMarginPercent: sales.gt(0) ? grossProfit.div(sales).mul(100).toFixed(2) : "0.00",
    otherIncome: income.toFixed(2),
    expenses: expense.toFixed(2),
    netProfit: netProfit.toFixed(2),
    uncostedPhysicalItems,
  };
}

export async function getMoreReports(range: DhakaDateRange) {
  const prisma = getPrisma();
  const [stockRows, customerGroups, courierGroups] = await Promise.all([
    prisma.$queryRaw<Array<{ warehouse: string; product: string; quantity: number; value: string }>>(Prisma.sql`
      SELECT w.name AS warehouse, p.name AS product,
             SUM(b.quantity_remaining)::int AS quantity,
             SUM(b.quantity_remaining * b.unit_cost)::numeric(14, 2)::text AS value
      FROM inventory_batches b
      INNER JOIN product_variants v ON v.id = b.variant_id
      INNER JOIN products p ON p.id = v.product_id
      INNER JOIN warehouses w ON w.id = b.warehouse_id
      WHERE b.quantity_remaining > 0
      GROUP BY w.id, w.name, p.id, p.name
      ORDER BY SUM(b.quantity_remaining * b.unit_cost) DESC
      LIMIT 50
    `),
    prisma.order.groupBy({
      by: ["customerId"],
      where: {
        customerId: { not: null },
        status: "DELIVERED",
        createdAt: { gte: range.startsAt, lt: range.endsBefore },
      },
      _count: { _all: true },
      _sum: { total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
    }),
    prisma.courierBooking.groupBy({
      by: ["provider", "status"],
      where: {
        createdAt: { gte: range.startsAt, lt: range.endsBefore },
      },
      _count: { _all: true },
    }),
  ]);

  const customerIds = customerGroups.flatMap((group) => group.customerId ? [group.customerId] : []);
  const customers = customerIds.length
    ? await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, phone: true },
    })
    : [];
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  return {
    stock: stockRows,
    customers: customerGroups.flatMap((group) => {
      if (!group.customerId) return [];
      const customer = customerById.get(group.customerId);
      return customer ? [{
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        orders: group._count._all,
        deliveredSales: group._sum.total?.toFixed(2) ?? "0.00",
      }] : [];
    }),
    couriers: courierGroups,
  };
}
