import { useState } from "react";
import { Card, SectionTitle, Button } from "@/components/ui";
import { api, formatPz } from "@/lib/api";

export default function Transferencia({ cuenta }) {
  const [to, setTo] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [concepto, setConcepto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  const enviar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const r = await api.transferir({
        from: cuenta?.id,
        to,
        cantidad: Number(cantidad),
        concepto,
      });
      setResultado(r.transferencia || r);
      setTo("");
      setCantidad("");
      setConcepto("");
    } catch (err) {
      setError(err.body?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Transferencia"
        subtitle="Envía Placetas a otra cuenta por IBAN o identificador."
      />

      <Card>
        <form onSubmit={enviar} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-brand-dark">Desde</label>
            <div className="rounded-xl border-2 border-brand/10 bg-brand/5 px-4 py-3 text-sm font-semibold text-brand-dark">
              {cuenta?.displayName || "Cuenta"} · {cuenta?.id || "—"}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-brand-dark">Destino (IBAN)</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
              className="w-full rounded-xl border-2 border-brand/15 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
              placeholder="GDLP-AP00-000"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-brand-dark">Cantidad (Pz)</label>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
              className="w-full rounded-xl border-2 border-brand/15 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
              placeholder="0"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-brand-dark">
              Concepto <span className="font-normal text-brand-dark/40">(opcional)</span>
            </label>
            <input
              type="text"
              value={concepto}
              maxLength={80}
              onChange={(e) => setConcepto(e.target.value)}
              className="w-full rounded-xl border-2 border-brand/15 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
              placeholder="¿Para qué es?"
            />
          </div>

          <Button type="submit" loading={loading} disabled={!to || !Number(cantidad)}>
            Enviar {cantidad ? formatPz(Number(cantidad)) + " Pz" : ""}
          </Button>
        </form>
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {error}
        </div>
      )}
      {resultado && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {resultado.mensaje || "Transferencia registrada."}{" "}
          {resultado.executionCode && (
            <span className="font-mono text-emerald-800">({resultado.executionCode})</span>
          )}
        </div>
      )}
    </div>
  );
}
