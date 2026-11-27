# Entorno de staging

Rama `staging` — para probar las integraciones con las APIs de las aseguradoras
antes de llevarlas a producción, a pedido de las propias aseguradoras.

**URL**: https://staging.cotizador.deltaseguros.com.ec

## Infraestructura

- **Vercel**: Preview Deployment propio de esta rama (mismo proyecto/cuenta que
  producción — ver ARCHITECTURE.md si se decide aislarlo más adelante). El
  dominio limpio de arriba está asociado a mano a cada deploy (`vercel alias
  set <url-del-deploy> staging.cotizador.deltaseguros.com.ec`) — a diferencia
  del alias automático `...-git-staging-....vercel.app` (que sí sigue los
  deploys solo), este hay que re-apuntarlo después de cada push a `staging`
  hasta configurar el seguimiento por rama desde el dashboard de Vercel
  (Project → Settings → Domains → editar este dominio → Git Branch).
- **Base de datos**: branch separado de Neon (`staging`, clonado de producción y
  luego reconstruido desde cero con `db:migrate` + RLS + `db:seed`/`db:seed:dev`/
  `db:seed:deducibles`) — **solo datos de prueba, nunca una copia de clientes
  reales**. Si se vuelve a clonar desde producción en el futuro, hay que repetir
  esa limpieza antes de usarlo.
- **Variables de entorno**: `AUTH_SECRET`, `DATABASE_URL` y `APP_URL` están en
  Vercel, scoped a Preview + rama `staging` únicamente — nunca comparten valor
  con producción.

## Correr algo contra esta base desde la máquina local

Sin tocar `.env.local` (que sigue apuntando a producción):

```bash
DATABASE_URL="<connection string de la rama staging en Neon>" npm run db:migrate
```

## Acceso

Login por correo+clave (`/login`), igual que producción — el link para crear
la clave del primer ADMIN se generó con `db:bootstrap-admin` y se entregó por
fuera de este repo.
