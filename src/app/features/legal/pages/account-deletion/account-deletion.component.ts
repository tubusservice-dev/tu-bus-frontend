import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalPageLayoutComponent } from '../../components/legal-page-layout/legal-page-layout.component';

/**
 * Public account-deletion instructions page. Required by the Google Play
 * account-deletion policy: a URL reachable WITHOUT installing the app or
 * signing in that explains how a user deletes their account and what happens
 * to their data. Mirrors the in-app flow (Perfil → Acciones → Eliminar
 * Cuenta) and the backend anonymization contract.
 */
@Component({
  selector: 'app-account-deletion',
  standalone: true,
  imports: [LegalPageLayoutComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legal-page-layout
      title="Eliminar tu cuenta"
      subtitle="Cómo eliminar tu cuenta de TuBus Express y qué ocurre con tus datos personales."
      lastUpdated="2026-06-04"
    >
      <section>
        <h2>1. Eliminar tu cuenta desde la app o la web</h2>
        <p>
          Puedes eliminar tu cuenta en cualquier momento, tú mismo, sin
          contactar a soporte:
        </p>
        <ul>
          <li>Inicia sesión en TuBus Express (app Android o sitio web).</li>
          <li>Entra a tu <strong>Perfil</strong>.</li>
          <li>En la sección <strong>Acciones</strong>, toca <strong>«Eliminar Cuenta»</strong>.</li>
          <li>
            Confirma tu identidad: si tu cuenta tiene contraseña, te pediremos
            tu contraseña; si entraste con Google o Apple, te pediremos escribir
            la palabra <strong>ELIMINAR</strong>.
          </li>
          <li>Marca la casilla de confirmación y completa la eliminación.</li>
        </ul>
        <div class="legal-callout">
          <strong>Aviso</strong>
          La eliminación es <strong>permanente e irreversible</strong>. No
          podrás recuperar tu cuenta ni tus datos personales una vez completada.
        </div>
      </section>

      <section>
        <h2>2. Si no puedes acceder a tu cuenta</h2>
        <p>
          Si perdiste el acceso y no puedes entrar a la app, escríbenos desde el
          correo asociado a tu cuenta a
          <a href="mailto:privacidad@tubusexpress.com">privacidad&#64;tubusexpress.com</a>
          con el asunto «Eliminar mi cuenta». Verificaremos tu identidad y
          procesaremos la solicitud en un plazo máximo de 30 días.
        </p>
      </section>

      <section>
        <h2>3. Qué datos eliminamos</h2>
        <p>Al eliminar tu cuenta borramos de forma definitiva:</p>
        <ul>
          <li>Tu nombre, correo electrónico, teléfono y dirección.</li>
          <li>Tu tipo y número de documento de identidad.</li>
          <li>Tu foto de perfil.</li>
          <li>Los vehículos guardados en tu garaje.</li>
          <li>Tus notificaciones y los tokens de tu dispositivo (dejas de recibir notificaciones push).</li>
          <li>El vínculo con tu cuenta de Google o Apple, si lo habías usado.</li>
        </ul>
      </section>

      <section>
        <h2>4. Qué datos conservamos y por qué</h2>
        <p>
          Por obligaciones contables, fiscales y legales conservamos el
          <strong>historial de pedidos y pagos</strong>, pero
          <strong>desvinculado de tu identidad</strong> (de forma anónima). Esos
          registros ya no permiten identificarte ni contactarte; solo se
          mantienen como soporte de las transacciones realizadas.
        </p>
      </section>

      <section>
        <h2>5. Pedidos o servicios en curso</h2>
        <p>
          Si al eliminar tu cuenta tienes pedidos o servicios mecánicos en
          curso, estos quedarán despersonalizados. Te recomendamos esperar a que
          finalicen antes de eliminar tu cuenta para no perder el seguimiento.
        </p>
      </section>

      <section>
        <h2>6. Más información</h2>
        <p>
          Esta página complementa nuestra
          <a routerLink="/legal/privacidad">Política de Privacidad</a>. Para
          cualquier duda sobre el tratamiento de tus datos escríbenos a
          <a href="mailto:privacidad@tubusexpress.com">privacidad&#64;tubusexpress.com</a>.
        </p>
      </section>
    </app-legal-page-layout>
  `,
})
export class AccountDeletionComponent {}
