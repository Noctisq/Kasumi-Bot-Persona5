# Kasumi Bot for discord



|     |    |
|------------|-------------|
| ![GitHub Logo](https://github.com/Noctisq/Kasumi-Bot-Persona5/blob/master/assets/images/kasumi.png)  |Kasumi es un bot para discord que está en early development, así que por ahora sus funcionalidades están limitadas a reproducir música y a unas cuántas interacciones con el usuario. No tiene ningún tipo de licencia así que pueden usar este código para crear sus propios bots.|

**Por favor, busca como crear tu aplicación para discord antes de proseguir, ya que se necesitará tu token para que puedas crear y usar tu propio bot.**
# Instalación.
Primero haz una clonación del repositorio de github
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
| ky!play <url> |Kasumi recibe un link de youtube o de pista de audio para reproducirla, si ya hay alguna sonando la añade a la cola. :white_heart:|
| ky!volume <numVol> |Kasumi recibe un número de entre 0-100 para subir o bajar el volumen de la música :musical_score:|
| ky!skip |Kasumi pasa a la siguiente canción en la cola :ghost:|
| ky!night |Kasumi te da las buenas noches. :milky_way:|
