package cn.ikun.music.device;

import androidx.media3.common.ForwardingSimpleBasePlayer;
import androidx.media3.common.Player;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;

/** 系统媒体键复用应用的队列与取流，避免另建一套歌曲顺序。 */
final class SessionPlayer extends ForwardingSimpleBasePlayer {
    private boolean previous;
    private boolean next;

    SessionPlayer(Player player) { super(player); }

    void setNavigation(boolean previous, boolean next) {
        this.previous = previous;
        this.next = next;
        invalidateState();
    }

    @Override protected State getState() {
        State state = super.getState();
        Player.Commands commands = state.availableCommands.buildUpon()
            .addIf(Player.COMMAND_SEEK_TO_PREVIOUS, previous)
            .addIf(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM, previous)
            .addIf(Player.COMMAND_SEEK_TO_NEXT, next)
            .addIf(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM, next).build();
        return state.buildUpon().setAvailableCommands(commands).build();
    }

    @Override protected ListenableFuture<?> handleSeek(int index, long position, int command) {
        if (command == Player.COMMAND_SEEK_TO_NEXT || command == Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM) {
            AndroidAudio.navigate("next");
            return Futures.immediateVoidFuture();
        }
        if (command == Player.COMMAND_SEEK_TO_PREVIOUS || command == Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM) {
            AndroidAudio.navigate("previous");
            return Futures.immediateVoidFuture();
        }
        return super.handleSeek(index, position, command);
    }

    @Override protected ListenableFuture<?> handleSetPlayWhenReady(boolean playWhenReady) {
        if (playWhenReady) AndroidAudio.prepareForPlayback();
        return super.handleSetPlayWhenReady(playWhenReady);
    }
}
