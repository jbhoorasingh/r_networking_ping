import logo from './logo.svg';
import './App.css';
import {
    Button,
    Grommet,
    grommet,
    Header,
    PageContent,
    Grid,
    Text,
    Box,
    Spinner,
    Layer
} from "grommet";
import {Moon, Sun, Add} from "grommet-icons";
import {deepMerge} from "grommet/utils"
import Endpoint from "./components/Endpoint";
import {useState, useEffect} from "react";
import axios from 'axios';


function App() {

    const theme = deepMerge(grommet, {
        global: {
            colors: {
                brand: '#228BE6',
            },
            font: {
                family: "Roboto",
                size: "18px",
                height: "20px",
            },
        },
    })
    const [dark, setDark] = useState(false);
    const [endpoints, setEndpoints] = useState([])
    const [lastModification, setLastModification] = useState(Date.now())
    const [showHostAddition, setShowHostAddition] = useState(false);

    const handleRefresh = () => {
        console.log(`${Date.now()} TEST2`)
        console.log(lastModification)
        setLastModification(Date.now())
        console.log(lastModification)
    };

    useEffect(() => {
        const interval = setInterval(() => {
            console.log('This will be called every 10 seconds');
            axios.get('http://10.0.0.250:8000/api/host/')
                .then(function (response) {
                    // handle success
                    // console.log(response.data);
                    setEndpoints(response.data)
                })
                .catch(function (error) {
                    // handle error
                    console.log(error);
                })
                .finally(function () {
                    // always executed
                });
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {

        console.log('This will be called every 10 seconds');
        axios.get('http://10.0.0.250:8000/api/host/')
            .then(function (response) {
                // handle success
                // console.log(response.data);
                setEndpoints(response.data)
            })
            .catch(function (error) {
                // handle error
                console.log(error);
            })
            .finally(function () {
                // always executed
            });

    }, [lastModification]);
    const AppBar = (props) => (
        <Header
            background="brand"
            pad={{left: "medium", right: "small", vertical: "small"}}
            elevation="medium"
            {...props}
        />
    )

    return (
        <div className="App">
            <Grommet theme={theme} full themeMode={dark ? "dark" : "light"}>
                <AppBar>
                    <Text size="large">r/Networking Ping</Text>
                    <Button icon={<Add/>} onClick={() => setShowHostAddition(true)} />
                    <Button
                        Title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        icon={dark ? <Moon/> : <Sun/>}
                        onClick={() => setDark(!dark)}
                    />
                </AppBar>
                <PageContent>
                    {/*<PageHeader title={'Host'}/>*/}
                    <Grid columns="medium" gap="medium" pad={{bottom: "medium", top: "medium"}}>

                        {endpoints.length !== 0 ?
                            endpoints.map((endpoint) => (
                                <Endpoint {...endpoint} handleRefresh={handleRefresh}/>
                                // Endpoint(
                                //     {
                                //         id: endpoint.id,
                                //         hostname: endpoint.hostname,
                                //         ip_address: endpoint.ip_address,
                                //         active: endpoint.active,
                                //         avg_rtt: endpoint.avg_rtt,
                                //         is_alive: endpoint.is_alive,
                                //         created: endpoint.created,
                                //         handleRefresh: handleRefresh
                                //     })
                            ))
                            : <Box alignContent={"center"} pad={"large"}>
                                <Spinner size={"xlarge"}/>
                            </Box>

                        }
                    </Grid>
                    {lastModification}
                    {showHostAddition && (
                        <Layer
                            onEsc={() => setShowHostAddition(false)}
                            onClickOutside={() => setShowHostAddition(false)}
                        >
                            <Button label="close" setShowHostAddition={() => setShowHostAddition(false)}/>
                        </Layer>
                    )}
                </PageContent>
            </Grommet>
        </div>
    );
}

export default App;
