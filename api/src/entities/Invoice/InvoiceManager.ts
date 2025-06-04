import { Between, Not } from "typeorm";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import { InvoiceEntity } from "./InvoiceEntity";
import { ClientEntity } from "../Client/ClientEntity";
import GlobalStore from "../../utils/GlobalStore";

dayjs.locale("fr");

export async function getCumulativeRevenueForYear(year: number): Promise<{
  labels: string[];
  values: number[];
}> {
  const months: string[] = [];
  const cumulativeValues: number[] = [];
  let cumulativeTotal = 0;

  for (let month = 0; month < 12; month++) {
    const start = dayjs(`${year}-${month + 1}-01`)
      .startOf("month")
      .toDate();
    const end = dayjs(start).endOf("month").toDate();
    const label = dayjs(start).format("MMMM");

    const [activeInvoices, passiveInvoices] = await Promise.all([
      InvoiceEntity.find({
        where: {
          archived: false,
          client: { id: Not(1) },
          createdAt: Between(start, end),
        },
        relations: {
          invoiceServices: true,
        },
      }),
      InvoiceEntity.find({
        where: {
          archived: false,
          client: { id: 1 },
          createdAt: Between(start, end),
        },
        relations: {
          invoiceServices: true,
        },
      }),
    ]);

    const totalActive = activeInvoices.reduce((total, invoice) => {
      return (
        total +
        invoice.invoiceServices.reduce(
          (sum, s) => sum + s.amount * s.quantity,
          0,
        )
      );
    }, 0);

    const totalPassive = passiveInvoices.reduce((total, invoice) => {
      return (
        total +
        invoice.invoiceServices.reduce(
          (sum, s) => sum + s.amount * s.quantity,
          0,
        )
      );
    }, 0);

    const net = totalActive - totalPassive;
    cumulativeTotal += net;

    months.push(label.charAt(0).toUpperCase() + label.slice(1));
    cumulativeValues.push(cumulativeTotal);
  }

  return { labels: months, values: cumulativeValues };
}

export async function getBestMonthOverall(): Promise<{
  year: number;
  month: string;
  value: number;
}> {
  const invoices = await InvoiceEntity.find({
    where: { archived: false },
    relations: { client: true, invoiceServices: true },
  });

  const monthMap = new Map<string, number>(); // clé = YYYY-MM

  for (const invoice of invoices) {
    const date = dayjs(invoice.createdAt);
    const key = date.format("YYYY-MM");

    const amount = invoice.invoiceServices.reduce(
      (sum, s) => sum + s.amount * s.quantity,
      0,
    );
    const isPassive = invoice.client.id === 1;
    const netAmount = isPassive ? -amount : amount;

    monthMap.set(key, (monthMap.get(key) || 0) + netAmount);
  }

  let best = { year: 0, month: "", value: -Infinity };

  for (const [key, value] of monthMap) {
    if (value > best.value) {
      const [year, monthNum] = key.split("-");
      const monthName = dayjs(`${year}-${monthNum}-01`).format("MMMM");
      best = {
        year: parseInt(year),
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        value,
      };
    }
  }

  return best;
}

export async function getBestYearOverall(): Promise<{
  year: number;
  value: number;
}> {
  const invoices = await InvoiceEntity.find({
    where: { archived: false },
    relations: { client: true, invoiceServices: true },
  });

  const yearMap = new Map<number, number>();

  for (const invoice of invoices) {
    const year = dayjs(invoice.createdAt).year();
    const amount = invoice.invoiceServices.reduce(
      (sum, s) => sum + s.amount * s.quantity,
      0,
    );
    const isPassive = invoice.client.id === 1;
    const signed = isPassive ? -amount : amount;

    yearMap.set(year, (yearMap.get(year) || 0) + signed);
  }

  let best = { year: 0, value: -Infinity };

  for (const [year, value] of yearMap) {
    if (value > best.value) {
      best = { year, value };
    }
  }

  return best;
}

export async function getBestClientOverall(): Promise<ClientEntity | null> {
  const invoices = await InvoiceEntity.find({
    where: {
      archived: false,
      client: { id: Not(1) },
    },
    relations: {
      client: true,
      invoiceServices: true,
    },
  });

  if (!invoices.length) return null;

  const clientTotals = new Map<
    number,
    { client: ClientEntity; total: number }
  >();

  for (const invoice of invoices) {
    const clientId = invoice.client.id;
    const client = invoice.client;
    const amount = invoice.invoiceServices.reduce(
      (sum, s) => sum + s.amount * s.quantity,
      0,
    );

    if (!clientTotals.has(clientId)) {
      clientTotals.set(clientId, { client, total: 0 });
    }

    clientTotals.get(clientId)!.total += amount;
  }

  let best: { client: ClientEntity; value: number } = {
    client: invoices[0].client,
    value: -Infinity,
  };

  for (const { client, total } of clientTotals.values()) {
    if (total > best.value) {
      best = { client, value: total };
    }
  }

  return best.client;
}

export async function getAvailableInvoiceYears(): Promise<number[]> {
  const dataSource = GlobalStore.getORM();
  const result = await dataSource
    .getRepository(InvoiceEntity)
    .createQueryBuilder("invoice")
    .select("DISTINCT YEAR(invoice.createdAt)", "year")
    .orderBy("year", "ASC")
    .getRawMany();

  return result.map((row) => parseInt(row.year));
}
