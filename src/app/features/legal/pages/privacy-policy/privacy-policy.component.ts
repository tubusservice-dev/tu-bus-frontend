import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LegalPageLayoutComponent } from '../../components/legal-page-layout/legal-page-layout.component';

/**
 * Public Privacy Policy. Aligned with Venezuelan personal-data practice and
 * with the data the platform actually processes (account, vehicle, payment,
 * dispatch). Each section names the concrete data category to keep the user
 * informed of what is collected and why — no generic boilerplate.
 */
@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [LegalPageLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legal-page-layout
      title="Política de Privacidad"
      subtitle="Cómo recolectamos, usamos y protegemos tus datos personales en TuBus Express. Tu privacidad es parte esencial de la confianza que nos das."
      lastUpdated="2026-05-05"
    >
      <section>
        <h2>1. Responsable del tratamiento</h2>
        <p>
          El responsable del tratamiento de tus datos personales es
          <strong>TuBus Express</strong>, con domicilio en Caracas, Venezuela.
          Para ejercer tus derechos o presentar consultas, escríbenos a
          <a href="mailto:privacidad@tubusexpress.com">privacidad&#64;tubusexpress.com</a>.
        </p>
      </section>

      <section>
        <h2>2. Datos que recolectamos</h2>
        <p>Tratamos las siguientes categorías de datos cuando interactúas con la plataforma:</p>

        <h3>2.1 Datos de cuenta</h3>
        <ul>
          <li>Nombre y apellido.</li>
          <li>Correo electrónico y, opcionalmente, teléfono / WhatsApp.</li>
          <li>Tipo y número de documento de identidad (V, E, J o P).</li>
          <li>Contraseña almacenada cifrada (nunca tenemos acceso al texto plano).</li>
        </ul>

        <h3>2.2 Datos de ubicación y facturación</h3>
        <ul>
          <li>Estado, ciudad, municipio, dirección y punto de referencia.</li>
          <li>Datos fiscales para facturación cuando lo solicites.</li>
        </ul>

        <h3>2.3 Datos de vehículo</h3>
        <ul>
          <li>Placa (opcional), marca, modelo, año y kilometraje.</li>
          <li>Tipo de motor y especificaciones declaradas para el servicio.</li>
        </ul>

        <h3>2.4 Datos de pago</h3>
        <ul>
          <li>Método utilizado, número de referencia, banco emisor y monto.</li>
          <li>Comprobante (imagen) cuando lo subes voluntariamente.</li>
          <li><strong>Nunca almacenamos números de tarjeta ni claves bancarias.</strong></li>
        </ul>

        <h3>2.5 Datos técnicos</h3>
        <ul>
          <li>Dirección IP, tipo de navegador, sistema operativo.</li>
          <li>Páginas visitadas, fecha y hora de acceso.</li>
          <li>Cookies y tecnologías equivalentes (ver Política de Cookies).</li>
        </ul>
      </section>

      <section>
        <h2>3. Para qué usamos tus datos</h2>
        <ul>
          <li>Crear y administrar tu cuenta de usuario.</li>
          <li>Procesar pedidos, pagos y despachos.</li>
          <li>Coordinar y confirmar el servicio de cambio de aceite.</li>
          <li>Comunicarnos contigo sobre el estado de tus órdenes y servicios.</li>
          <li>Atender consultas, reclamos o solicitudes de garantía.</li>
          <li>Cumplir obligaciones legales, contables y tributarias.</li>
          <li>Mejorar la plataforma mediante análisis estadístico agregado.</li>
        </ul>
      </section>

      <section>
        <h2>4. Base de legitimación</h2>
        <p>El tratamiento de tus datos se sustenta en alguna de las siguientes bases:</p>
        <ul>
          <li><strong>Consentimiento</strong> que otorgas al registrarte.</li>
          <li><strong>Ejecución del contrato</strong> de compraventa o prestación del servicio.</li>
          <li><strong>Cumplimiento de obligaciones legales</strong> (tributarias, contables).</li>
          <li><strong>Interés legítimo</strong> en prevenir el fraude y mejorar la experiencia.</li>
        </ul>
      </section>

      <section>
        <h2>5. Con quién compartimos tus datos</h2>
        <p>Solo compartimos datos con terceros cuando es estrictamente necesario:</p>
        <ul>
          <li><strong>Mecánicos y sucursales autorizadas</strong> que ejecutan el servicio (nombre, contacto, dirección, datos del vehículo).</li>
          <li><strong>Agencias de envío</strong> que despachan tus productos (nombre, teléfono, dirección, descripción del envío).</li>
          <li><strong>Proveedores de infraestructura</strong> (hosting, almacenamiento de imágenes, mensajería transaccional) bajo acuerdos de confidencialidad.</li>
          <li><strong>Autoridades competentes</strong> cuando la ley así lo exija.</li>
        </ul>
        <p>
          <strong>No vendemos tus datos</strong> ni los cedemos para fines
          publicitarios de terceros.
        </p>
      </section>

      <section>
        <h2>6. Tiempo de conservación</h2>
        <p>
          Conservamos tus datos mientras tu cuenta esté activa y por el tiempo
          necesario para cumplir las obligaciones legales (típicamente diez años
          para registros contables y tributarios). Cuando solicites la
          eliminación de tu cuenta, anonimizamos o suprimimos los datos que ya
          no estemos obligados a conservar.
        </p>
      </section>

      <section>
        <h2>7. Tus derechos</h2>
        <p>En cualquier momento puedes ejercer los siguientes derechos:</p>
        <ul>
          <li><strong>Acceso</strong> a los datos que tratamos sobre ti.</li>
          <li><strong>Rectificación</strong> de información inexacta o desactualizada.</li>
          <li><strong>Supresión</strong> ("derecho al olvido") cuando ya no sean necesarios.</li>
          <li><strong>Oposición</strong> a tratamientos basados en interés legítimo.</li>
          <li><strong>Portabilidad</strong> de tus datos en formato estructurado.</li>
          <li><strong>Revocación</strong> del consentimiento previamente otorgado.</li>
        </ul>
        <p>
          Para ejercer cualquiera de estos derechos escribe a
          <a href="mailto:privacidad@tubusexpress.com">privacidad&#64;tubusexpress.com</a>
          identificándote con el correo registrado en tu cuenta. Responderemos
          en un plazo máximo de quince (15) días hábiles.
        </p>
      </section>

      <section>
        <h2>8. Seguridad</h2>
        <p>
          Aplicamos medidas técnicas y organizativas razonables para proteger
          tus datos: cifrado en tránsito (HTTPS), almacenamiento de contraseñas
          con algoritmos de hashing, segmentación de accesos por rol y registros
          de auditoría sobre operaciones sensibles.
        </p>
        <div class="legal-callout">
          <strong>Recuerda</strong>
          Ningún sistema es invulnerable. Cuídate de correos sospechosos, no
          compartas tu contraseña y avísanos de inmediato ante cualquier acceso
          extraño a tu cuenta.
        </div>
      </section>

      <section>
        <h2>9. Menores de edad</h2>
        <p>
          La plataforma no está dirigida a menores de 18 años. Si detectamos
          que se ha creado una cuenta con datos de un menor sin autorización del
          representante legal, procederemos a eliminarla.
        </p>
      </section>

      <section>
        <h2>10. Cambios a esta política</h2>
        <p>
          Esta política puede actualizarse para reflejar cambios legales o
          mejoras operativas. La fecha de la última revisión está visible en la
          cabecera. Cuando los cambios sean materiales, te notificaremos por
          correo electrónico o un aviso destacado en la plataforma.
        </p>
      </section>

      <section>
        <h2>11. Contacto</h2>
        <p>
          Para cualquier consulta relacionada con privacidad escríbenos a
          <a href="mailto:privacidad@tubusexpress.com">privacidad&#64;tubusexpress.com</a>.
          Para temas comerciales generales,
          <a href="mailto:soporte@tubusexpress.com">soporte&#64;tubusexpress.com</a>.
        </p>
      </section>
    </app-legal-page-layout>
  `,
})
export class PrivacyPolicyComponent {}
