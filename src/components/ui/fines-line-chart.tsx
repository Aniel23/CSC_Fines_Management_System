import * as React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltipContent, ChartLegendContent } from "@/components/ui/chart";
import { useFines } from "@/hooks/useFines";
import { format, subDays, eachDayOfInterval, startOfDay, isSameDay } from "date-fns";

function groupFinesByDate(fines: { created_at: string; amount: number; status: string; balance: number }[]) {
  // Generate last 30 days
  const endDate = startOfDay(new Date());
  const startDate = subDays(endDate, 29);
  const last30Days = eachDayOfInterval({ start: startDate, end: endDate });

  return last30Days.map((date) => {
    const dayFines = fines.filter((f) => isSameDay(new Date(f.created_at), date));
    
    const amount = dayFines.reduce((sum, f) => sum + f.amount, 0);
    const paidAmount = dayFines.reduce((sum, f) => sum + (f.amount - f.balance), 0);
    const count = dayFines.length;

    return {
      label: format(date, "MMM d"),
      fullDate: format(date, "yyyy-MM-dd"),
      amount,
      paidAmount,
      count,
    };
  });
}

export default function FinesLineChart() {
  const { fines, loading } = useFines();
  
  const data = React.useMemo(() => {
    if (fines.length === 0) return [];
    return groupFinesByDate(fines as any);
  }, [fines]);

  const config = {
    amount: { label: "Total Fine", color: "#f59e0b" },
    paidAmount: { label: "Amount Paid", color: "#10b981" },
    count: { label: "Fine Count", color: "#3b82f6" },
  } as const;

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading chart...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-muted-foreground">No data available</div>
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
          <XAxis 
            dataKey="label" 
            tick={{ fontSize: 11 }} 
            tickLine={false} 
            axisLine={false}
            minTickGap={15}
          />
          <YAxis 
            yAxisId="left" 
            allowDecimals={false} 
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'Count', angle: -90, position: 'insideLeft', fontSize: 11, offset: 10 }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `₱${v}`}
            label={{ value: 'Amount', angle: 90, position: 'insideRight', fontSize: 11, offset: 10 }}
          />
          <Tooltip 
            content={<ChartTooltipContent 
              labelKey="fullDate"
              formatter={(v, name) => {
                if (name === "Count" || name === "count") return v;
                return typeof v === "number" ? `₱${v.toLocaleString()}` : String(v);
              }} 
            />} 
          />
          <Legend 
            verticalAlign="top" 
            align="right" 
            content={<ChartLegendContent />} 
            wrapperStyle={{ paddingBottom: 20 }}
          />

          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey="count" 
            name="Count" 
            stroke="var(--color-count)" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="amount" 
            name="Total Fine" 
            stroke="var(--color-amount)" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="paidAmount" 
            name="Amount Paid" 
            stroke="var(--color-paidAmount)" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
