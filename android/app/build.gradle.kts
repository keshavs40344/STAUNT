plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.staunt.browser"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.staunt.browser"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "2.0.0"
    }

    signingConfigs {
        create("release") {
            val envPath = System.getenv("KEYSTORE_PATH")
            val defaultPath = "${System.getProperty("user.home")}/.android/staunt-release.keystore"
            val keystoreFile = when {
                !envPath.isNullOrEmpty() && file(envPath).exists() -> file(envPath)
                file(defaultPath).exists() -> file(defaultPath)
                else -> null
            }
            if (keystoreFile != null) {
                storeFile = keystoreFile
                keyAlias = System.getenv("KEY_ALIAS") ?: "staunt-release"
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyPassword = System.getenv("KEY_PASSWORD")
                enableV1Signing = true
                enableV2Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            val releaseSigning = signingConfigs.getByName("release")
            if (releaseSigning.storeFile == null || !releaseSigning.storeFile!!.exists()) {
                throw org.gradle.api.GradleException(
                    "Release build aborted: Keystore file not found. Ensure KEYSTORE_PATH or ~/.android/staunt-release.keystore is present."
                )
            }
            signingConfig = releaseSigning
        }
    }

    gradle.taskGraph.whenReady {
        if (allTasks.any { it.name.contains("Release", ignoreCase = true) }) {
            val storePass = System.getenv("KEYSTORE_PASSWORD")
            val keyPass = System.getenv("KEY_PASSWORD")
            if (storePass.isNullOrEmpty() || keyPass.isNullOrEmpty()) {
                throw org.gradle.api.GradleException(
                    "Release build aborted: Required signing credentials missing. Set KEYSTORE_PASSWORD and KEY_PASSWORD environment variables."
                )
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.cardview:cardview:1.0.0")
}