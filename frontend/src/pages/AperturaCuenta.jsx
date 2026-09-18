import { useState } from "react";
import { api } from "@/lib/api";

const TIPOS = [
  { value: "Current", label: "Cuenta personal", description: "Cuenta corriente para tu uso diario." },
  { value: "Business", label: "Cuenta de empresa", description: "Requiere una entidad con EIP verificado en RSP." },
  { value: "Junior", label: "Cuenta Junior", description: "Se crea desde la app de Placeta Junior." },
  { value: "Joven", label: "Cuenta Joven", description: "Se genera con la suscripción de Placeta Joven." },
];

export default function AperturaCuenta() {
  const [tipoCuenta, setTipoCuenta] = useState("Current");
  const [displayName, setDisplayName] = useState("");
  const [eip, setEip] = useState("");
  const [accountPurpose, setAccountPurpose] = useState("");
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const selected = TIPOS.find((item) => item.value === tipoCuenta) || TIPOS[0];

  async function submit(event) {
    event.preventDefault();
    setFeedback(null);
    setWorking(true);
    try {
      const result = await api.solicitarApertura({ tipoCuenta, displayName, eip, accountPurpose });
      setFeedback({ type: "success", text: result.message || "Solicitud enviada. Confirma la firma desde PlacetaID Móvil." });
    } catch (error) {
      const body = error.body || {};
      setFeedback({ type: "error", text: body.message || error.message || "No se pudo iniciar el alta." , redirect: body.redirect });
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="eyebrow">Cuentas y medios</p>
        <h2 className="text-3xl font-extrabold text-brand-dark">Abrir una cuenta</h2>
        <p className="mt-2 max-w-2xl text-sm text-brand-dark/60">La solicitud se envía a PlacetaID Móvil. La cuenta solo se crea después de tu firma.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TIPOS.map((item) => (
          <button
            type="button"
            key={item.value}
            onClick={() => setTipoCuenta(item.value)}
            className={`rounded-2xl border-2 p-5 text-left transition ${tipoCuenta === item.value ? "border-brand bg-brand/5" : "border-brand/10 bg-white hover:border-brand/30"}`}
          >
            <strong className="block text-brand-dark">{item.label}</strong>
            <span className="mt-1 block text-sm text-brand-dark/60">{item.description}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-3xl border border-brand/10 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-extrabold text-brand-dark">{selected.label}</h3>
          <p className="mt-1 text-sm text-brand-dark/60">{selected.description}</p>
        </div>
        <label className="block text-sm font-semibold text-brand-dark">
          Nombre visible de la cuenta
          <input className="mt-2 w-full rounded-xl border-2 border-brand/10 px-3 py-2.5 outline-none focus:border-brand" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={`Cuenta ${selected.label}`} />
        </label>
        {tipoCuenta === "Business" && (
          <>
            <label className="block text-sm font-semibold text-brand-dark">
              EIP verificado en RSP
              <input required className="mt-2 w-full rounded-xl border-2 border-brand/10 px-3 py-2.5 uppercase outline-none focus:border-brand" value={eip} onChange={(event) => setEip(event.target.value)} placeholder="EIP-..." />
            </label>
            <label className="block text-sm font-semibold text-brand-dark">
              Proyecto y finalidad
              <textarea required className="mt-2 min-h-24 w-full rounded-xl border-2 border-brand/10 px-3 py-2.5 outline-none focus:border-brand" value={accountPurpose} onChange={(event) => setAccountPurpose(event.target.value)} placeholder="Describe el proyecto que operará la cuenta" />
            </label>
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Las empresas elegibles pueden recibir una subvención de 5.000 Pz del Banco de La Placeta hasta el 31 de diciembre de 2026, siempre con EIP verificado y justificación de pagos de impuestos mediante RSP.</p>
          </>
        )}
        {(tipoCuenta === "Junior" || tipoCuenta === "Joven") && (
          <p className="rounded-xl bg-brand/5 p-3 text-sm text-brand-dark">Esta web no crea este tipo de cuenta. Usa el servicio indicado para completar el alta.</p>
        )}
        <button type="submit" disabled={working} className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
          {working ? "Enviando solicitud…" : "Enviar a PlacetaID Móvil para firmar"}
        </button>
        {feedback && (
          <div className={`rounded-xl p-3 text-sm ${feedback.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
            <p>{feedback.text}</p>
            {feedback.redirect && <a className="mt-2 inline-block font-bold underline" href={feedback.redirect} target="_blank" rel="noreferrer">Continuar en el servicio correspondiente</a>}
          </div>
        )}
      </form>
    </section>
  );
}
