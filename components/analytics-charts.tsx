'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { useT } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n/translate';

interface AnalyticsChartsProps {
  paymentsByMethod: Record<string, number>;
  ordersByStatus: Record<string, number>;
  bookingsByStatus?: Record<string, number>;
  orderRevenue?: number;
  hotelRevenue?: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];
const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const PAYMENT_METHODS = ['CASH', 'CARD', 'CHEQUE', 'TRANSFER', 'MOBILE', 'AUTRE'];

export function AnalyticsCharts({ 
  paymentsByMethod, 
  ordersByStatus,
  bookingsByStatus = {},
  orderRevenue = 0,
  hotelRevenue = 0
}: AnalyticsChartsProps) {
  const { t, format } = useT();
  const labelFor = (prefix: string, known: string[], value: string) =>
    known.includes(value) ? t(`${prefix}.${value}` as TranslationKey) : value;
  const paymentData = Object.entries(paymentsByMethod).map(([method, amount]) => ({
    name: labelFor('common.paymentMethods', PAYMENT_METHODS, method),
    value: parseFloat(amount.toFixed(2)),
  }));

  const orderData = Object.entries(ordersByStatus).map(([status, count]) => ({
    name: labelFor('orders.status', ORDER_STATUSES, status),
    count,
  }));

  const bookingData = Object.entries(bookingsByStatus).map(([status, count]) => ({
    name: labelFor('hotel.bookingStatus', BOOKING_STATUSES, status),
    count,
  }));

  const moduleData = [
    { name: t('analytics.charts.restaurant'), value: orderRevenue },
    { name: t('analytics.charts.hotel'), value: hotelRevenue },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module Breakdown */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-50">{t('analytics.charts.byModule')}</CardTitle>
          </CardHeader>
          <CardContent>
            {moduleData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-slate-400">
                {t('analytics.charts.noModuleData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={moduleData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${format.money(value)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {moduleData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => format.money(Number(value))}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payments by Method */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-50">{t('analytics.charts.byPaymentMethod')}</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-slate-400">
                {t('analytics.charts.noPaymentData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${format.money(value)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => format.money(Number(value))}
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-50">{t('analytics.charts.ordersByStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            {orderData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-slate-400">
                {t('analytics.charts.noOrderData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={orderData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar dataKey="count" name={t('analytics.charts.count')} fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bookings by Status */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-50">{t('analytics.charts.bookingsByStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            {bookingData.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-slate-400">
                {t('analytics.charts.noBookingData')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={bookingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar dataKey="count" name={t('analytics.charts.count')} fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

