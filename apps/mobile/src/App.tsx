import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PROJECT_NAME } from '@msef/core';
export default function App() { return <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f7f6' }}><View style={{ padding: 24, gap: 12 }}><Text style={{ fontSize: 24, fontWeight: '700', color: '#235c54' }}>{PROJECT_NAME}</Text><Text>Native mobile app scaffold. The first usable map is in the web app; verified data and mobile map integration come next.</Text></View><StatusBar style="auto"/></SafeAreaView>; }
