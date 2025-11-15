#!/bin/bash

echo "=== COMPREHENSIVE JAVA VERSION FIX ==="

# Find ALL gradle files in node_modules that might have Java 21
echo "Searching for Java 21 references in node_modules..."
find node_modules -name "*.gradle" -type f | while read file; do
    if grep -q "JavaVersion.VERSION_21" "$file"; then
        echo "Fixing: $file"
        sed -i 's/JavaVersion.VERSION_21/JavaVersion.VERSION_17/g' "$file"
        sed -i 's/sourceCompatibility.*21/sourceCompatibility JavaVersion.VERSION_17/g' "$file"
        sed -i 's/targetCompatibility.*21/targetCompatibility JavaVersion.VERSION_17/g' "$file"
        sed -i 's/jvmTarget.*21/jvmTarget = "17"/g' "$file"
    fi
done

# Also check for numeric Java versions
find node_modules -name "*.gradle" -type f | while read file; do
    if grep -q "21" "$file" && grep -q "JavaVersion" "$file"; then
        echo "Fixing numeric Java 21 in: $file"
        sed -i 's/JavaVersion\.VERSION_1_21/JavaVersion.VERSION_17/g' "$file"
        sed -i 's/JavaVersion\.21/JavaVersion.17/g' "$file"
    fi
done

echo "=== CHECKING FIXES ==="
echo "Remaining Java 21 references:"
find node_modules -name "*.gradle" -type f -exec grep -l "JavaVersion.VERSION_21" {} \;

echo "=== FIX COMPLETED ==="