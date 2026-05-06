import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalPageLayoutComponent } from '../../components/legal-page-layout/legal-page-layout.component';

/**
 * Public Cookies Policy. Describes the storage technologies actually in use
 * (auth token, theme preference, cart state, PWA service worker) so users can
 * make an informed decision rather than reading a generic catalogue of
 * trackers we do not deploy.
 */
@Component({
  selector: 'app-cookies-policy',
  standalone: true,
  imports: [LegalPageLayoutComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legal-page-layout
      title="Política de Cookies"
      subtitle="Qué son las cookies, cuáles utiliza TuBus Express y cómo puedes gestionarlas desde tu navegador."
      lastUpdated="2026-05-05"
    >
      <section>
        <h2>1. ¿Qué es una cookie?</h2>
        <p>
          Una <strong>cookie</strong> es un pequeño archivo de texto que un
          sitio web guarda en tu navegador para recordar información entre
          visitas (por ejemplo: si iniciaste sesión, qué tienes en el carrito,
          qué tema visual prefieres). Junto con las cookies, los sitios pueden
          usar tecnologías equivalentes como
          <strong>localStorage</strong> y <strong>sessionStorage</strong>, que
          se rigen por esta misma política.
        </p>
      </section>

      <section>
        <h2>2. ¿Por qué las usamos?</h2>
        <p>
          En TuBus Express utilizamos almacenamiento local con tres propósitos
          claros: hacer funcionar la plataforma, recordar tus preferencias
          básicas y mantener tu sesión segura. <strong>No usamos cookies de
          publicidad ni de seguimiento de terceros.</strong>
        </p>
      </section>

      <section>
        <h2>3. Categorías de cookies que utilizamos</h2>

        <h3>3.1 Estrictamente necesarias</h3>
        <p>Son imprescindibles para que el sitio funcione. No requieren consentimiento.</p>
        <ul>
          <li><strong>Token de sesión</strong> (JWT) — mantiene tu inicio de sesión activo durante 12 horas.</li>
          <li><strong>Estado del carrito</strong> — recuerda los productos que añadiste antes de finalizar la compra.</li>
          <li><strong>Sesión de OAuth</strong> — necesaria para el inicio de sesión con Google o Facebook.</li>
        </ul>

        <h3>3.2 De preferencia</h3>
        <p>Mejoran tu experiencia, pero el sitio funciona sin ellas.</p>
        <ul>
          <li><strong>Tema visual</strong> (claro / oscuro) — recuerda tu elección entre visitas.</li>
          <li><strong>Última zona / sucursal</strong> seleccionada para acelerar futuros pedidos.</li>
        </ul>

        <h3>3.3 Funcionales (PWA)</h3>
        <p>
          Si instalas TuBus Express como aplicación en tu dispositivo móvil, el
          navegador registra un <strong>Service Worker</strong> para habilitar la
          experiencia tipo app. Este Service Worker no almacena tus datos
          personales ni tus pedidos: solo cumple los requisitos técnicos de
          instalabilidad. No realiza tracking.
        </p>

        <h3>3.4 De terceros</h3>
        <p>
          Cuando compartes una cuenta con Google o Facebook para autenticarte,
          esos proveedores pueden establecer sus propias cookies en tu
          navegador. El uso de esas cookies se rige por las políticas de cada
          proveedor:
        </p>
        <ul>
          <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Política de Google</a></li>
          <li><a href="https://www.facebook.com/policy.php" target="_blank" rel="noopener">Política de Meta / Facebook</a></li>
        </ul>
      </section>

      <section>
        <h2>4. ¿Cuánto duran?</h2>
        <ul>
          <li><strong>De sesión:</strong> se eliminan al cerrar el navegador.</li>
          <li><strong>Persistentes:</strong> permanecen hasta su fecha de expiración o hasta que las elimines manualmente. El token de sesión expira a las 12 horas; las preferencias visuales se conservan hasta que las cambies.</li>
        </ul>
      </section>

      <section>
        <h2>5. Cómo gestionarlas</h2>
        <p>
          Puedes consultar, bloquear o eliminar las cookies en cualquier momento
          desde la configuración de tu navegador:
        </p>
        <ul>
          <li><strong>Chrome:</strong> Configuración → Privacidad y seguridad → Cookies y otros datos de sitios.</li>
          <li><strong>Firefox:</strong> Ajustes → Privacidad y seguridad → Cookies y datos del sitio.</li>
          <li><strong>Safari:</strong> Preferencias → Privacidad → Gestionar datos de sitios web.</li>
          <li><strong>Edge:</strong> Configuración → Cookies y permisos del sitio.</li>
        </ul>
        <div class="legal-callout">
          <strong>Aviso</strong>
          Si bloqueas las cookies estrictamente necesarias, no podrás iniciar
          sesión ni completar pedidos en la plataforma. Las cookies de
          preferencia pueden bloquearse sin afectar la funcionalidad básica.
        </div>
      </section>

      <section>
        <h2>6. Cambios a esta política</h2>
        <p>
          Si introducimos nuevas cookies o tecnologías de almacenamiento,
          actualizaremos esta página y modificaremos la fecha de última
          actualización. Te recomendamos revisarla periódicamente.
        </p>
      </section>

      <section>
        <h2>7. Más información</h2>
        <p>
          Esta Política de Cookies complementa nuestra
          <a routerLink="/legal/privacidad">Política de Privacidad</a>. Para
          dudas adicionales escríbenos a
          <a href="mailto:privacidad@tubusexpress.com">privacidad&#64;tubusexpress.com</a>.
        </p>
      </section>
    </app-legal-page-layout>
  `,
})
export class CookiesPolicyComponent {}
