import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OtpInput from "@/components/OtpInput";
import { Card, SectionTitle, Button, Badge, EmptyState } from "@/components/ui";
import { api, formatPz } from "@/lib/api";

function useCountdown(seconds) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (!seconds) return;
    setLeft(seconds);
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(id);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return left;
}

export default function Placezum({ cuenta, cuentas }) {
  const [tab, setTab] = useState("cobrar");
  const [codigo, setCodigo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  // Pago
  const [payCode, setPayCode] = useState("");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState(null);

  const left = useCountdown(codigo ? 120 : 0);

  const generar = async () => {
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const r = await api.placezumCodigo(cuenta?.id);
      setCodigo(r.codigo?.code || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const pagar = async () => {
    setPayLoading(true);
    setPayError(null);
    setResultado(null);
    try {
      const r = await api.placezumPagar({
        from: cuenta?.id,
        codigo: payCode,
        cantidad: Number(amount),
        concepto: concept,
      });
      setResultado(r.placezum || r);
      setPayCode("");
      setAmount("");
      setConcept("");
    } catch (e) {
      setPayError(e.body?.error || e.message);
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle
          title="PlaceZUM"
          subtitle="Cobra o paga en un zum con un código temporal de 5 dígitos."
          className="mb-0"
        />
        <div className="flex rounded-xl border border-brand/15 bg-white p-1">
          {["cobrar", "pagar"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError(null);
                setResultado(null);
              }}
              className={
                "rounded-lg px-4 py-1.5 text-sm font-bold capitalize transition-colors " +
                (tab === t ? "bg-brand text-white" : "text-brand-dark/60 hover:text-brand")
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "cobrar" ? (
        <Card>
          <p className="text-sm text-brand-dark/60">
            Genera un código que expira en 2 minutos. Quien lo introduzca podrá enviarte
            Placetas directamente.
          </p>

          {!codigo ? (
            <Button onClick={generar} loading={loading} className="mt-5">
              Generar código
            </Button>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-5 flex flex-col items-center gap-4 rounded-2xl bg-brand/5 p-6"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-brand-dark/50">
                  Tu código PlaceZUM
                </p>
                <div className="flex gap-2">
                  {String(codigo)
                    .split("")
                    .map((d, i) => (
                      <span
                        key={i}
                        className="grid h-16 w-12 place-items-center rounded-xl bg-white text-2xl font-extrabold text-brand-dark shadow-sm"
                      >
                        {d}
                      </span>
                    ))}
                </div>
                <p className="text-sm text-brand-dark/60">
                  Expira en{" "}
                  <span className="font-bold text-brand">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>
                </p>
                {left === 0 && (
                  <p className="text-sm font-semibold text-rose-500">Código caducado. Genera otro.</p>
                )}
                <Button variant="ghost" onClick={generar} loading={loading}>
                  Regenerar
                </Button>
              </motion.div>
            </AnimatePresence>
          )}
        </Card>
      ) : (
        <Card className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-brand-dark">
              Código del destinatario
            </label>
            <OtpInput length={5} value={payCode} onChange={setPayCode} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-brand-dark">Cantidad (Pz)</label>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
                value={concept}
                maxLength={80}
                onChange={(e) => setConcept(e.target.value)}
                className="w-full rounded-xl border-2 border-brand/15 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
                placeholder="Ej. Cañas con la peña"
              />
            </div>
          </div>

          <Button onClick={pagar} loading={payLoading} disabled={payCode.length !== 5 || !Number(amount)}>
            Enviar {amount ? formatPz(Number(amount)) + " Pz" : ""}
          </Button>
        </Card>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {error}
        </div>
      )}
      {payError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {payError}
        </div>
      )}
      {resultado && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {resultado.mensaje || "Operación realizada correctamente."}
        </div>
      )}

      <Card>
        <SectionTitle title="¿Qué es PlaceZUM?" className="mb-2" />
        <p className="text-sm leading-relaxed text-brand-dark/60">
          PlaceZUM es la forma más rápida de enviar Placetas entre cuentas de la Placeta.
          El código se genera a partir de tu cuenta y caduca a los 2 minutos por seguridad.
          La operación queda pendiente de firma y se ejecuta al confirmarla en PlacetaID Móvil.
        </p>
      </Card>
    </div>
  );
}
