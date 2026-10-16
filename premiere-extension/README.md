# Mickey Studio for Premiere Pro

Version 2.8.33 of the UXP panel. The deployed website and this panel use the same Mickey Studio account and API service; the panel polls the website's motion-scene queue for jobs sent from the Motion Builder.

## Install or update

1. Extract `MickeyStudio-Premiere.zip` to a local folder.
2. In Adobe UXP Developer Tool, choose **Add Plugin**, select the extracted `manifest.json`, then load the plugin into Premiere Pro.
3. Keep the website and the panel signed in to the same Mickey Studio account to receive scenes.

The silence analyzer adds review markers only. It does not delete media or ripple-close gaps. SRT files are imported into the Premiere project; they are not automatically placed on the timeline.
