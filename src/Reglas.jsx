import React from "react";
import { Link } from "react-router-dom";
import Button from "./Button";

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
            <Button variant="dark" size="sm" pill>← Regresar</Button>
          </Link>
        </div>

        <hr style={{ border: "none", borderTop: "2px solid #eee", margin: "20px 0" }} />

        {/* Descripción general */}
        <Section title="📋 ¿De qué se trata?">
          <p>
            Cada semana los participantes predicen al ganador de cada partido de la NFL, además de
            dos picks extra de medio punto por partido: qué equipo tendrá <b>más yardas por pase</b>,
            y qué equipo tendrá <b>más yardas por acarreo</b>. El participante con más puntos en
            total al final de la semana se lleva el pozo de esa semana. Si hay empate en puntos,
            los marcadores de desempate deciden al ganador.
          </p>
        </Section>

        {/* Cómo participar */}
        <Section title="📝 Cómo Registrar tus Picks">
          <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>
              Inicia sesión con tu nombre de usuario y PIN de 4 dígitos (crea una cuenta la primera
              vez — tu nombre completo queda ligado a tu cuenta, así que siempre se registra
              correctamente).
            </li>
            <li>Ingresa tu <b>correo electrónico</b> (se usa para enviarte una copia de tus picks).</li>
            <li>
              Para cada partido, selecciona a tu <b>ganador</b> — más dos picks extra de medio
              punto, obligatorios: qué equipo tendrá <b>más yardas por pase</b>, y qué equipo
              tendrá <b>más yardas por acarreo</b>. Los tres son necesarios para que ese partido
              cuente como completado.
            </li>
            <li>Ingresa tu predicción de <b>puntos totales combinados</b> para los tres partidos de desempate.</li>
            <li>Dale clic a <b>"Submit Picks"</b> antes del límite de tiempo. ¡Listo!</li>
          </ol>
          <Callout type="warning">
            ⚠️ Revisa todo antes de enviar — por ahora no se puede volver a enviar para cambiar un
            pick individual, así que es mejor acertarle desde la primera vez.
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
              <b>Bloqueo por partido</b> — Cada partido (y sus dos picks extra obligatorios) se
              bloquea automáticamente <b>1 hora antes del kickoff</b>. Si un partido ya está
              bloqueado cuando intentas enviar, debes seleccionar todos los demás partidos
              disponibles — no puedes enviar con un pick de ganador o extra faltante de un partido
              que ya empezó.
            </li>
          </ul>
          <Callout type="warning">
            ⚠️ No esperes hasta el último momento. Si el límite pasa o un partido arranca antes
            de que envíes, tus picks no serán aceptados para esa semana.
          </Callout>
          <p style={{ marginTop: 12, fontSize: 13, color: "#666" }}>
            Cuando un partido se bloquea, su columna en la <b>Tabla de Picks</b> revela el pick de
            todos para ese partido. Si alguien no envió un pick, en su lugar aparece el logo de la NFL.
          </p>
        </Section>

        {/* Puntuación */}
        <Section title="🏆 Puntuación">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li><b>1 punto</b> por cada partido que aciertes correctamente.</li>
            <li><b>+0.5 puntos extra</b> por cada pick correcto de "más yardas por pase".</li>
            <li><b>+0.5 puntos extra</b> por cada pick correcto de "más yardas por acarreo".</li>
            <li><b>0 puntos</b> por un pick incorrecto o un partido que no seleccionaste.</li>
            <li>El participante con <b>más puntos</b> al final de la semana gana el pozo.</li>
          </ul>
          <p style={{ marginTop: 10, fontSize: 13, color: "#666" }}>
            Las yardas por pase y por acarreo de cada partido se calculan del box score oficial
            después de que termina el partido — esto usualmente toma unas horas en publicarse, así
            que esos dos picks extra pueden seguir pendientes aunque el marcador final ya esté
            disponible. Si algún equipo empata exactamente en esa estadística, ese pick extra no
            se resuelve y nadie gana esos puntos.
          </p>
          <p style={{ marginTop: 12 }}>
            Ejemplo: Si hay 16 partidos y aciertas 11 ganadores, más 5 picks correctos de yardas
            por pase y 6 picks correctos de yardas por acarreo, tu puntaje es
            11 + (5 × 0.5) + (6 × 0.5) = <b>16.5</b>.
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
            <li>
              Usa el botón de <b>Payment Options</b> en el encabezado del sitio para pagar por
              Venmo, Cash App, PayPal o Zelle.
            </li>
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
            <li>Tu nombre completo queda ligado a tu cuenta, así que siempre se registra igual — ya no tienes que preocuparte por escribirlo distinto cada semana.</li>
            <li>Antes de hacer tus picks, revisa el récord de cada equipo, que se muestra justo en la página de picks.</li>
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
          <Button variant="secondary" onClick={() => window.print()}>
            🖨️ Imprimir / Guardar como PDF
          </Button>
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
