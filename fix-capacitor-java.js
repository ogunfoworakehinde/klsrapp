import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Fixing Capacitor Android plugin Java version...');

// Fix the main Capacitor Android plugin
const capacitorBuildGradle = path.join('node_modules', '@capacitor', 'android', 'capacitor', 'build.gradle');
if (fs.existsSync(capacitorBuildGradle)) {
    let content = fs.readFileSync(capacitorBuildGradle, 'utf8');
    content = content.replace(/sourceCompatibility JavaVersion\.VERSION_21/g, 'sourceCompatibility JavaVersion.VERSION_17');
    content = content.replace(/targetCompatibility JavaVersion\.VERSION_21/g, 'targetCompatibility JavaVersion.VERSION_17');
    fs.writeFileSync(capacitorBuildGradle, content);
    console.log('Fixed main Capacitor Android plugin');
}

// Fix individual plugin build files
const plugins = ['app', 'haptics', 'keyboard', 'share', 'status-bar'];
plugins.forEach(plugin => {
    const pluginBuildGradle = path.join('node_modules', '@capacitor', plugin, 'android', 'build.gradle');
    if (fs.existsSync(pluginBuildGradle)) {
        let content = fs.readFileSync(pluginBuildGradle, 'utf8');
        content = content.replace(/sourceCompatibility JavaVersion\.VERSION_21/g, 'sourceCompatibility JavaVersion.VERSION_17');
        content = content.replace(/targetCompatibility JavaVersion\.VERSION_21/g, 'targetCompatibility JavaVersion.VERSION_17');
        fs.writeFileSync(pluginBuildGradle, content);
        console.log(`Fixed ${plugin} plugin`);
    }
});

console.log('Java version fix completed');