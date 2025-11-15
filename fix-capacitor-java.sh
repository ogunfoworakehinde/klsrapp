#!/bin/bash

echo "Fixing Capacitor Android plugin Java version..."

# Fix the main Capacitor Android plugin
if [ -f "node_modules/@capacitor/android/capacitor/build.gradle" ]; then
    sed -i 's/sourceCompatibility JavaVersion.VERSION_21/sourceCompatibility JavaVersion.VERSION_17/g' node_modules/@capacitor/android/capacitor/build.gradle
    sed -i 's/targetCompatibility JavaVersion.VERSION_21/targetCompatibility JavaVersion.VERSION_17/g' node_modules/@capacitor/android/capacitor/build.gradle
    echo "Fixed main Capacitor Android plugin"
fi

# Fix individual plugin build files
plugins=("app" "haptics" "keyboard" "share" "status-bar")
for plugin in "${plugins[@]}"; do
    if [ -f "node_modules/@capacitor/$plugin/android/build.gradle" ]; then
        sed -i 's/sourceCompatibility JavaVersion.VERSION_21/sourceCompatibility JavaVersion.VERSION_17/g' "node_modules/@capacitor/$plugin/android/build.gradle"
        sed -i 's/targetCompatibility JavaVersion.VERSION_21/targetCompatibility JavaVersion.VERSION_17/g' "node_modules/@capacitor/$plugin/android/build.gradle"
        echo "Fixed $plugin plugin"
    fi
done

echo "Java version fix completed"