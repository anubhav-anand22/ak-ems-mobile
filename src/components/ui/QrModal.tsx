import { useGlobalState } from "@/lib/gState";
import { useState } from "react";
import { Dimensions, View } from "react-native";
import {
  Button,
  Card,
  Dialog,
  Icon,
  IconButton,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import { QrCodeSvg } from "react-native-qr-svg";

const QrModal = () => {
  const setQrCodeData = useGlobalState((s) => s.setQrCodeData);
  const qrCodeData = useGlobalState((s) => s.qrCodeData);
  const dim = Dimensions.get("window");
  const [qrSize, setQrSize] = useState(dim.width - 200);
  const appTheme = useTheme();

  return (
    <Portal>
      <Dialog visible={!!qrCodeData} onDismiss={() => setQrCodeData(null)}>
        <Dialog.Title>
          QR Code {qrCodeData?.appVersion ? `v${qrCodeData.appVersion}` : null}
        </Dialog.Title>
        <Dialog.Content
          onLayout={({ nativeEvent }) => {
            setQrSize(nativeEvent.layout.width - 48);
          }}
          style={{ gap: 10 }}
        >
          {qrCodeData?.url && (
            <QrCodeSvg
              value={qrCodeData.url}
              frameSize={qrSize}
              backgroundColor={appTheme.colors.elevation.level3}
              dotColor={appTheme.colors.primary}
            />
          )}
          <Card style={{ flexDirection: "row" }}>
            <Card.Content>
              <Text selectable>{qrCodeData?.url}</Text>
            </Card.Content>
            {/*<Card.Actions>
              <IconButton icon={"content-copy"} />
            </Card.Actions>*/}
          </Card>
        </Dialog.Content>
        <Dialog.Actions>
          {/*<Button icon={"content-copy"} onPress={() => {}}>
            Copy URL
          </Button>*/}
          <Button onPress={() => setQrCodeData(null)} style={{paddingHorizontal: 20}} mode="contained">
            CLOSE
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default QrModal;
