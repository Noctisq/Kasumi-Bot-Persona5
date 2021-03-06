# Kasumi Bot for discord



|     |    |
|------------|-------------|
| ![Kasumi](https://github.com/Noctisq/Kasumi-Bot-Persona5/blob/master/assets/images/kasumi.png)  |Kasumi es un bot para discord que está en early development, así que por ahora sus funcionalidades están limitadas a reproducir música y a unas cuántas interacciones con el usuario. No tiene ningún tipo de licencia así que pueden usar este código para crear sus propios bots.|

**Por favor, busca como crear tu aplicación para discord antes de proseguir, ya que se necesitará tu token para que puedas crear y usar tu propio bot.**
# Instalación.
Primero clona el repositorio de github
```javascript
git clone <https://github.com/Noctisq/Kasumi-Bot-Persona5.git>
```
Una vez clonado ejecuta el siguiente comando en la raiz del proyecto para instalar las dependencias necesarias:
```javascript
npm install
```
Una vez dentro del proyecto tienes que crear un archivo .json. Ponle como nombre config.json:
```json
{
	"prefix": "<prefijo que desees i.e: ky! //Por defecto ky! es el prefijo elegido.>", 
	"token": "<tuToken>"
}
```

# Kasumi en acción.
Para poder hacer que Kasumi empiece a trabajar, en la raiz de nuestro proyecto ejecutamos el siguiente comando:
```javascript
npm run kasumi //Recuerda que puedes cambiar el comando por uno de tu agrado dentro del package.json
```
Kasumi cuenta con la siguiente lista de comandos:
|Comando |Descripción    |
|------------|-------------|
| ky!love |Kasumi interactúa contigo :heartbeat:|
| ky!help |Kasumi abre una ventana de ayuda dentro de discord :smile:| 
| ky!play <url> |Kasumi recibe un link de youtube o un string de búsqueda, si ya hay alguna sonando la añade a la cola. :white_heart:|
| ky!pause |Kasumi pausa la música :black_heart:|
| ky!resume |Kasumi reanuda la música :black_heart:|
| ky!reset|Kasumi limpia la cola de canciones :black_heart:|	
| ky!volume <numVol> |Kasumi recibe un número de entre 0-100 para subir o bajar el volumen de la música :musical_score:|
| ky!skip |Kasumi pasa a la siguiente canción en la cola :ghost:|
| ky!night |Kasumi te da las buenas noches. :milky_way:|
| ky!pause |Kasumi para sus funciones :black_heart:|

# Añadiendo nuevos comandos.
En la carpeta *commands* encontraras todos los comandos que Kasumi puede utilizar.
La estructura de un comando es la siguiente: 
```javascript
module.exports = {
	name: '<nombredelComando>',
	description: '<Una breve descripción>',
	async execute(parámetros) { 
        	...
		...
		...
	};



```
Para saber más sobre qué tipo de comandos puedes hacer ve a [la documentación oficial](https://discordjs.guide/).

# Sobre los comandos
**¿Por qué los comandos tienen esa estructura? ¿No puedo construirlos de otra manera?**
Sí, si puedes. Pero **en este caso** es necesario seguir esta estructura.\
En nuestro index.js encontramos en las primeras líneas de código lo siguiente:
```javascript
bot.commands = new Discord.Collection();

const commandFiles = fs
  .readdirSync("./commands")
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  bot.commands.set(command.name, command);
}
```
Se crea una colección para poder guardar los comandos que vayamos creando.
```javascript
bot.commands = new Discord.Collection();
```
Aquí usamos un módulo nativo de Nodejs para poder leer los archivos js de nuestra carpeta de comandos
```javascript
const commandFiles = fs
  .readdirSync("./commands")
  .filter((file) => file.endsWith(".js"));
}
```

Iteramos commandFiles y por cada uno de los archivos encontrados los requerimos y los añadimos a nuestra colección.
```javascript
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  bot.commands.set(command.name, command);
}
```
Gracias a este proceso podemos hacer un require() de cada uno de nuestros comandos de manera dinámica y no necesitamos hacer hard code de los mismos. Puedes crear tu propia estructura, pero si tu bot tendrá como base a kasumi es necesario que sigas la misma estructura para todos los comandos que vayas a crear.
