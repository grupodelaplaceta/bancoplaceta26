import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, SectionTitle, Button } from "@/components/ui";
import { api, formatPz } from "@/lib/api";

export default function Transferencia({ cuenta }) {
  const [to, setTo] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [concepto, setConcepto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [review, setReview] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(null);

  const revisar = (e) => {
    e.preventDefault();
    if (!to.trim() || !Number(cantidad) || Number(cantidad) <= 0) return;
    setIdempotencyKey(window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}-${Math.random()}`);
    setReview(true);
  };

  const enviar = async () => {
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const r = await api.transferir({
        from: cuenta?.id,
        to,
        cantidad: Number(cantidad),
        concepto,
      }, idempotencyKey);
      setResultado(r.transferencia || r);
      setTo("");
      setCantidad("");
      setConcepto("");
      setReview(false);
      setIdempotencyKey(null);
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
        <form onSubmit={revisar} className="space-y-5">
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
              onChange={(e) => { setTo(e.target.value); setIdempotencyKey(null); }}
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
              onChange={(e) => { setCantidad(e.target.value); setIdempotencyKey(null); }}
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
              onChange={(e) => { setConcepto(e.target.value); setIdempotencyKey(null); }}
              className="w-full rounded-xl border-2 border-brand/15 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
              placeholder="¿Para qué es?"
            />
          </div>

          <Button type="submit" disabled={!to || !Number(cantidad) || Number(cantidad) <= 0}>
            Revisar transferencia
          </Button>
        </form>
      </Card>

      <AnimatePresence>
        {review && <motion.div className="payment-review-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) setReview(false); }}>
          <motion.section role="dialog" aria-modal="true" aria-labelledby="transfer-review-title" className="payment-review-card" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}>
            <h2 id="transfer-review-title">Confirma la transferencia</h2>
            <p>Comprueba los datos antes de enviar. El cargo requerirá la firma de tu operación.</p>
            <dl><div><dt>Desde</dt><dd>{cuenta?.displayName || cuenta?.id}</dd></div><div><dt>Destino</dt><dd>{to}</dd></div><div><dt>Importe</dt><dd>{formatPz(Number(cantidad))} Pz</dd></div>{concepto.trim() && <div><dt>Concepto</dt><dd>{concepto}</dd></div>}</dl>
            {error && <p className="payment-review-error" role="alert">{error}</p>}
            <div className="payment-review-actions"><button type="button" disabled={loading} onClick={() => setReview(false)}>Volver</button><button type="button" disabled={loading} onClick={enviar}>{loading ? "Enviando…" : "Confirmar y enviar"}</button></div>
          </motion.section>
        </motion.div>}
      </AnimatePresence>

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
