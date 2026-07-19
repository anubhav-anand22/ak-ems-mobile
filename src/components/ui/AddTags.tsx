import { View } from "react-native";
import { TextInput, Dialog, Portal, Button, Chip } from "react-native-paper";
import { useGlobalState } from "../../lib/gState";
import ReactiveKVStore from "@/lib/reactiveKV";
import { useState } from "react";

export default function AddTags() {
  const { addTagDialogShow, setAddTagDialogShow } = useGlobalState();
  const tags = ReactiveKVStore.useReactiveKVStore((s) => s.tags);
  const addTags = ReactiveKVStore.useReactiveKVStore((s) => s.addTags);
  const deleteTag = ReactiveKVStore.useReactiveKVStore((s) => s.deleteTag);
  const [tagsTxt, setTagsTxt] = useState("");

  return (
    <Portal>
      <Dialog
        visible={addTagDialogShow}
        onDismiss={() => setAddTagDialogShow(false)}
      >
        <Dialog.Title>Add Tag</Dialog.Title>
        <Dialog.Content style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {tags.map((tag) => (
              <Chip key={tag} mode="outlined" onClose={() => deleteTag(tag)}>
                {tag}
              </Chip>
            ))}
          </View>
          <TextInput
            label="Tags (separate multiple tags with commas)"
            mode="outlined"
            value={tagsTxt}
            onChangeText={setTagsTxt}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setAddTagDialogShow(false)}>Close</Button>
          <Button
            style={{ paddingHorizontal: 10 }}
            mode="contained"
            onPress={() => {
              const tags = tagsTxt
                .split(",")
                .map((tag) => tag.trim())
                .filter((tags) => !!tags);
              addTags(tags);
              setAddTagDialogShow(false);
              setTagsTxt("");
            }}
          >
            Add
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
