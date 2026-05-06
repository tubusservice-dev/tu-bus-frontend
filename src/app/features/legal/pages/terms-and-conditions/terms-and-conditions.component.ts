import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LegalPageLayoutComponent } from '../../components/legal-page-layout/legal-page-layout.component';

/**
 * Public Terms & Conditions page. Plain-language Spanish copy adapted to
 * TuBus Express — an automotive parts e-commerce with at-home oil-change
 * service operating in Venezuela. Content is intentionally embedded in the
 * template so it ships as static HTML and is indexable by search engines
 * without an extra round-trip to the API.
 */
@Component({
  selector: 'app-terms-and-conditions',
  standalone: true,
  imports: [LegalPageLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-legal-page-layout
      title="Términos y Condiciones"
      subtitle="Lee con atención antes de usar nuestra plataforma. Al registrarte o realizar un pedido aceptas las condiciones descritas a continuación."
      lastUpdated="2026-05-05"
    >
      <section>
        <h2>1. Identificación del prestador</h2>
        <p>
          <strong>TuBus Express</strong> es una plataforma de comercio
          electrónico que ofrece la venta de repuestos automotrices, lubricantes
          y el servicio de cambio de aceite a domicilio o en sucursal,
          principalmente en el territorio de la República Bolivariana de
          Venezuela. La operación de la plataforma se realiza desde nuestras
          oficinas comerciales y en coordinación con sucursales y mecánicos
          autorizados.
        </p>
      </section>

      <section>
        <h2>2. Aceptación del usuario</h2>
        <p>
          El acceso, registro o realización de cualquier pedido en TuBus Express
          implica la aceptación plena y sin reservas de los presentes Términos y
          Condiciones, así como de la Política de Privacidad y la Política de
          Cookies. Si no estás de acuerdo con alguna parte, debes abstenerte de
          usar la plataforma.
        </p>
        <p>
          Al ser un menor de edad o representante de un tercero, asumes que
          cuentas con la autorización correspondiente para contratar.
        </p>
      </section>

      <section>
        <h2>3. Cuenta de usuario</h2>
        <p>Para realizar compras o solicitar el servicio de cambio de aceite, deberás crear una cuenta proporcionando información veraz y actualizada. Eres responsable de:</p>
        <ul>
          <li>Mantener la confidencialidad de tu contraseña.</li>
          <li>Toda actividad realizada bajo tu cuenta.</li>
          <li>Notificarnos de inmediato cualquier acceso no autorizado.</li>
        </ul>
        <p>
          TuBus Express podrá suspender o cancelar cuentas que incumplan estos
          términos, suministren datos falsos o realicen un uso fraudulento de la
          plataforma.
        </p>
      </section>

      <section>
        <h2>4. Productos y precios</h2>
        <p>
          Los precios de los productos se expresan en dólares de los Estados
          Unidos de América (USD) y, cuando corresponda, en bolívares (Bs.) a la
          tasa de cambio vigente publicada por el Banco Central de Venezuela
          (BCV) al momento de la compra.
        </p>
        <ul>
          <li>Las imágenes son ilustrativas y pueden variar respecto al producto físico.</li>
          <li>La disponibilidad está sujeta al inventario de cada sucursal.</li>
          <li>Nos reservamos el derecho de modificar precios sin previo aviso; el precio aplicable es el vigente al confirmar el pedido.</li>
        </ul>
      </section>

      <section>
        <h2>5. Proceso de compra y pago</h2>
        <p>
          El usuario selecciona los productos, elige el método de despacho
          (retiro en tienda, agencia, delivery local, vendedor o servicio de
          cambio de aceite a domicilio) y registra el pago a través de uno de
          los métodos disponibles.
        </p>
        <p>
          La orden se considera <strong>aprobada</strong> únicamente cuando
          nuestro equipo confirma la recepción y verificación del pago. Los
          pedidos pendientes de verificación pueden cancelarse si transcurre el
          plazo definido sin recibir confirmación.
        </p>
      </section>

      <section>
        <h2>6. Servicio de cambio de aceite</h2>
        <p>
          Al elegir el servicio de cambio de aceite a domicilio o en sucursal,
          el cliente debe seleccionar la fecha y horario de su preferencia
          (Express, Mañana o Agendado). Un mecánico autorizado se asigna y
          confirmará la cita.
        </p>
        <p>
          El cliente se compromete a proporcionar un espacio adecuado para el
          servicio y a verificar la información de su vehículo (marca, modelo,
          tipo de motor). La información sobre modificaciones del motor debe
          declararse al momento del pedido para evitar daños y para no anular
          posibles garantías.
        </p>
        <div class="legal-callout">
          <strong>Importante</strong>
          La omisión o falsedad en la información del vehículo libera a TuBus
          Express de responsabilidad sobre daños derivados.
        </div>
      </section>

      <section>
        <h2>7. Despacho y entrega</h2>
        <ul>
          <li><strong>Retiro en tienda:</strong> el cliente recoge en la sucursal seleccionada en el horario informado.</li>
          <li><strong>Agencia de envío:</strong> el pedido se despacha a la agencia indicada y el costo de flete corre por cuenta del cliente al retirarlo.</li>
          <li><strong>Delivery local:</strong> entrega en la dirección registrada dentro de la zona de cobertura.</li>
          <li><strong>Acuerdo con vendedor:</strong> coordinación directa con el equipo de ventas.</li>
        </ul>
        <p>
          Los tiempos de entrega son estimados y pueden variar por causas ajenas
          a TuBus Express (clima, tráfico, paros del transporte, retrasos de la
          agencia, etc.).
        </p>
      </section>

      <section>
        <h2>8. Cancelaciones, devoluciones y reembolsos</h2>
        <p>
          El cliente puede solicitar la cancelación de una orden mientras se
          encuentre en estado <strong>pendiente</strong> o
          <strong>aprobada</strong>, antes del despacho o del inicio del
          servicio. Las solicitudes posteriores serán evaluadas caso por caso.
        </p>
        <p>
          Las devoluciones de producto proceden cuando el artículo presenta
          defectos de fábrica o no corresponde con lo solicitado, dentro de los
          siete (7) días calendario desde la entrega y conservando empaque,
          etiquetas y comprobante de compra.
        </p>
        <p>
          Los reembolsos se realizan al mismo método de pago utilizado, en un
          plazo máximo de quince (15) días hábiles luego de aprobada la
          devolución.
        </p>
      </section>

      <section>
        <h2>9. Garantías</h2>
        <p>
          Los productos cuentan con la garantía del fabricante, que se hace
          efectiva siguiendo los procedimientos indicados por cada marca. TuBus
          Express actúa como intermediario para gestionar reclamos de garantía,
          pero no extiende garantías propias salvo indicación expresa del
          producto.
        </p>
        <p>
          El servicio de cambio de aceite tiene una garantía operativa de
          treinta (30) días sobre la mano de obra. La garantía no cubre daños
          posteriores derivados del uso del vehículo o de productos no
          suministrados por TuBus Express.
        </p>
      </section>

      <section>
        <h2>10. Propiedad intelectual</h2>
        <p>
          La marca <strong>TuBus Express</strong>, el logotipo, el contenido del
          sitio (textos, imágenes, código, diseño) son propiedad de TuBus
          Express o están licenciados a su favor. Está prohibida su reproducción
          total o parcial sin autorización escrita.
        </p>
      </section>

      <section>
        <h2>11. Limitación de responsabilidad</h2>
        <p>
          TuBus Express no será responsable por daños indirectos, lucro cesante
          o pérdidas derivadas del uso o imposibilidad de uso de la plataforma,
          siempre que no medie dolo o culpa grave de su parte. Tampoco
          respondemos por interrupciones del servicio causadas por fallas del
          proveedor de internet, electricidad o terceros.
        </p>
      </section>

      <section>
        <h2>12. Modificaciones</h2>
        <p>
          Podemos modificar estos Términos y Condiciones en cualquier momento
          para adaptarlos a cambios legales, operativos o comerciales. La
          versión vigente es la publicada en esta página, con la fecha de
          actualización visible en la cabecera.
        </p>
      </section>

      <section>
        <h2>13. Ley aplicable y jurisdicción</h2>
        <p>
          Estos Términos se rigen por las leyes de la República Bolivariana de
          Venezuela. Cualquier controversia será resuelta por los tribunales
          competentes de la ciudad de Caracas, salvo norma de orden público en
          contrario.
        </p>
      </section>

      <section>
        <h2>14. Contacto</h2>
        <p>
          Para consultas sobre estos términos puedes escribirnos a
          <a href="mailto:soporte@tubusexpress.com">soporte&#64;tubusexpress.com</a>
          o a través del WhatsApp publicado en nuestra página de contacto.
        </p>
      </section>
    </app-legal-page-layout>
  `,
})
export class TermsAndConditionsComponent {}
