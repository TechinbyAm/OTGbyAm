/**
 * This file is customizable BUT — do not remove:
 *   • `<AuthModal />` render (shipped v2 auth modal; removing it breaks
 *     signin/signup since useAuth().signIn() only flips state, not render)
 *   • `useAuth().initiate()` + `isReady` gate (loads persisted session from
 *     SecureStore — removing causes user to appear signed-out on app launch)
 *
 * Safe to change: the Stack routes, QueryClient config, splash behavior, the
 * wrapping providers, or to add nested providers around <Stack>.
 */
'use client';

import { ErrorBoundary } from "@/__create/ErrorBoundary";
import { useAuth } from "@/utils/auth/useAuth";
import { AuthModal } from "@/utils/auth/useAuthModal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	DMMono_400Regular,
	DMMono_500Medium,
	DMSans_400Regular,
	DMSans_500Medium,
	DMSans_700Bold,
	PlayfairDisplay_500Medium_Italic,
	PlayfairDisplay_600SemiBold,
	PlayfairDisplay_700Bold,
	useFonts,
} from "@expo-google-fonts/dev";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Text, TextInput } from "react-native";
void SplashScreen.preventAutoHideAsync();

// Cap OS-level text-size (Dynamic Type / accessibility) scaling app-wide.
// Without this, a large system font setting scales every <Text> up 1:1,
// which blows out tight layouts (badges, chips, itinerary bullets) — this
// only shows up on a real device, never in a browser preview, since browsers
// don't simulate iOS/Android system font scale. 1.3x still gives real users
// meaningfully larger text without breaking layout.
// @ts-expect-error — defaultProps is untyped but supported by RN for this purpose
Text.defaultProps = Text.defaultProps || {};
// @ts-expect-error
Text.defaultProps.maxFontSizeMultiplier = 1.3;
// @ts-expect-error
TextInput.defaultProps = TextInput.defaultProps || {};
// @ts-expect-error
TextInput.defaultProps.maxFontSizeMultiplier = 1.3;

const SPLASH_TIMEOUT_MS = 10_000;

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5, // 5 minutes
			gcTime: 1000 * 60 * 30, // 30 minutes
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});

export default function RootLayout() {
	const { initiate, isReady } = useAuth();
	const [timedOut, setTimedOut] = useState(false);
	const [fontsLoaded] = useFonts({
		PlayfairDisplay_600SemiBold,
		PlayfairDisplay_700Bold,
		PlayfairDisplay_500Medium_Italic,
		DMSans_400Regular,
		DMSans_500Medium,
		DMSans_700Bold,
		DMMono_400Regular,
		DMMono_500Medium,
	});

	useEffect(() => {
		initiate();
	}, [initiate]);

	useEffect(() => {
		const timeout = setTimeout(() => setTimedOut(true), SPLASH_TIMEOUT_MS);
		return () => clearTimeout(timeout);
	}, []);

	useEffect(() => {
		if ((isReady && fontsLoaded) || timedOut) {
			void SplashScreen.hideAsync();
		}
	}, [isReady, fontsLoaded, timedOut]);

	if (!(isReady && fontsLoaded) && !timedOut) {
		return null;
	}

	return (
		<ErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<GestureHandlerRootView style={{ flex: 1 }}>
					<Stack screenOptions={{ headerShown: false }} initialRouteName="(tabs)">
						<Stack.Screen name="(tabs)" />
					</Stack>
					<AuthModal />
				</GestureHandlerRootView>
			</QueryClientProvider>
		</ErrorBoundary>
	);
}
