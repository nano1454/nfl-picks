import React from "react";
import { Link } from "react-router-dom";

export default function Reglas() {
  return (
    <div
      style={{
        background: "url('/background.png') center / cover no-repeat fixed",
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          width: "100%",
          background: "rgba(255,255,255,0.93)",
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          padding: "32px 36px",
          fontFamily: "system-ui, sans-serif",
          color: "#111",
        }}
      >
        {/* Encabezado */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>🏈 Quiniela NFL Semanal</h1>
            <p style={{ margin: "4px 0 0", color: "#555", fontSize: 14 }}>Reglas, Instrucciones y Cómo Jugar</p>
          </div>
          <Link to="/">
            <button style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              ← Regresar
            </button>
          </Link>
        </div>

        <hr style={{ border: "none", borderTop: "2px solid #eee", margin: "20px 0" }} />

        {/* Descripción general */}
        <Section title="📋 ¿De qué se trata?">
          <p>
            Cada semana los participantes predicen al ganador de cada partido de la NFL. El que
            acierte más partidos se lleva el pozo de esa semana. Si hay empate en puntos, los
            marcadores de desempate deciden al ganador.
          </p>
        </Section>

        {/* Cómo participar */}
        <Section title="📝 Cómo Registrar tus Picks">
          <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>Entra a la página de picks e ingresa tu <b>nombre completo</b> y <b>correo electrónico</b>.</li>
            <li>Selecciona al ganador de <b>cada partido</b> del calendario de esa semana.</li>
            <li>Ingresa tu predicción de <b>puntos totales combinados</b> para los tres partidos de desempate.</li>
            <li>Dale clic a <b>"Submit Picks"</b> antes del límite de tiempo. ¡Listo!</li>
          </ol>
          <Callout>
            ✅ Puedes volver a enviar tus picks antes del límite para actualizarlos — tu último envío reemplaza al anterior.
          </Callout>
        </Section>

        {/* Límite de tiempo y bloqueos */}
        <Section title="⏰ Límite de Tiempo y Bloqueos">
          <p>Hay <b>dos tipos de bloqueos</b> que debes tener en cuenta:</p>
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>
              <b>Límite semanal</b> — Una hora fija que establece el administrador cada semana
              (generalmente antes del primer partido). Una vez que pasa ese límite, la quiniela
              se bloquea y no se aceptan más envíos.
            </li>
            <li>
              <b>Bloqueo por partido</b> — Cada partido se bloquea automáticamente <b>1 hora antes
              del kickoff</b>. Si un partido ya está bloqueado cuando intentas enviar, debes
              seleccionar todos los demás partidos disponibles — no puedes enviar con un pick
              faltante de un partido que ya empezó.
            </li>
          </ul>
          <Callout type="warning">
            ⚠️ No esperes hasta el último momento. Si el límite pasa o un partido arranca antes
            de que envíes, tus picks no serán aceptados para esa semana.
          </Callout>
        </Section>

        {/* Puntuación */}
        <Section title="🏆 Puntuación">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li><b>1 punto</b> por cada partido que aciertes correctamente.</li>
            <li><b>0 puntos</b> por un pick incorrecto o un partido que no seleccionaste.</li>
            <li>El participante con <b>más puntos</b> al final de la semana gana el pozo.</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Ejemplo: Si hay 16 partidos y aciertas 11, tu puntaje es <b>11</b>.
          </p>
        </Section>

        {/* Desempates */}
        <Section title="🔢 Desempates (Reglas de El Precio es Correcto)">
          <p>
            Tres partidos cada semana son designados como <b>partidos de desempate</b>. Para cada
            uno, predices el <b>total de puntos combinados</b> de ambos equipos (por ejemplo, si
            el marcador final es 24–17, el total es <b>41</b>).
          </p>
          <p style={{ marginTop: 12 }}>
            Los desempates solo se usan cuando dos o más participantes terminan con el <b>mismo
            número de picks correctos</b>. El ganador del desempate se determina así:
          </p>
          <ul style={{ paddingLeft: 20, lineHeight: 2, marginTop: 8 }}>
            <li>
              Gana el participante cuya predicción sea <b>la más cercana al total real
              sin pasarse</b>.
            </li>
            <li>
              Si tu predicción <b>supera</b> el total real de puntos, tu desempate queda
              <b> anulado</b> — no cuenta.
            </li>
            <li>
              Si todos los participantes empatados se pasan, el desempate no se resuelve
              y el pozo se divide.
            </li>
          </ul>
          <Callout>
            💡 Funciona como <b>El Precio es Correcto</b> — el más cercano sin pasarse gana.
            Si el total real es 41, un guess de 40 le gana a uno de 45, y un guess de 42 queda anulado.
          </Callout>
          <p style={{ marginTop: 12 }}>
            Los desempates se evalúan en orden (TB1, TB2, TB3). Si TB1 no resuelve el empate,
            se revisa TB2 y luego TB3.
          </p>
        </Section>

        {/* Buy-in y premio */}
        <Section title="💵 Aportación Semanal y Premio">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>Cada participante paga una <b>aportación semanal</b> para entrar al pozo de esa semana.</li>
            <li>El participante con <b>más picks correctos</b> se lleva todo el pozo semanal.</li>
            <li>El pago debe ser confirmado por el administrador antes de que se finalicen los resultados.</li>
            <li>El monto de la aportación y los detalles del premio los comunica el organizador cada semana.</li>
          </ul>
          <Callout type="warning">
            ⚠️ Si no se recibe el pago antes del límite, el administrador se reserva el derecho
            de eliminar tus picks de esa semana.
          </Callout>
        </Section>

        {/* Consejos */}
        <Section title="💬 Consejos para Nuevos Participantes">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>Envía tus picks con tiempo — no te arriesgues a perder el límite o a que se bloquee un partido.</li>
            <li>Para los desempates, ve un poco por debajo de lo que intuyes — pasarte anula tu entrada.</li>
            <li>Usa tu nombre <b>exactamente igual</b> cada semana para que tu historial se registre correctamente.</li>
            <li>Revisa el <b>Marcador en Vivo</b> durante la semana para ver cómo vas mientras los partidos se van cerrando.</li>
          </ul>
        </Section>

        {/* Pie de página */}
        <hr style={{ border: "none", borderTop: "2px solid #eee", margin: "24px 0 16px" }} />
        <p style={{ textAlign: "center", fontSize: 13, color: "#888" }}>
          ¿Tienes dudas? Comunícate con el organizador del grupo. ¡Buena suerte! 🏈
        </p>

        {/* Botón imprimir */}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button
            onClick={() => window.print()}
            style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid #ccc", background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
          >
            🖨️ Imprimir / Guardar como PDF
          </button>
        </div>
      </div>

      {/* Estilos de impresión */}
      <style>{`
        @media print {
          body { background: white !important; }
          button { display: none !important; }
          div[style*="background: url"] { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 10px", color: "#111" }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.7, color: "#222" }}>{children}</div>
    </div>
  );
}

function Callout({ children, type = "info" }) {
  const bg = type === "warning" ? "rgba(200,80,0,0.07)" : "rgba(0,100,200,0.07)";
  const border = type === "warning" ? "rgba(200,80,0,0.3)" : "rgba(0,100,200,0.25)";
  return (
    <div style={{
      marginTop: 12,
      padding: "10px 14px",
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 10,
      fontSize: 14,
      lineHeight: 1.6,
    }}>
      {children}
    </div>
  );
}
