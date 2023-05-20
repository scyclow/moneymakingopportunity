// SPDX-License-Identifier: MIT


/*

 /$$      /$$  /$$$$$$  /$$   /$$ /$$$$$$$$ /$$     /$$       /$$      /$$  /$$$$$$  /$$   /$$ /$$$$$$ /$$   /$$  /$$$$$$
| $$$    /$$$ /$$__  $$| $$$ | $$| $$_____/|  $$   /$$/      | $$$    /$$$ /$$__  $$| $$  /$$/|_  $$_/| $$$ | $$ /$$__  $$
| $$$$  /$$$$| $$  \ $$| $$$$| $$| $$       \  $$ /$$/       | $$$$  /$$$$| $$  \ $$| $$ /$$/   | $$  | $$$$| $$| $$  \__/
| $$ $$/$$ $$| $$  | $$| $$ $$ $$| $$$$$     \  $$$$/        | $$ $$/$$ $$| $$$$$$$$| $$$$$/    | $$  | $$ $$ $$| $$ /$$$$
| $$  $$$| $$| $$  | $$| $$  $$$$| $$__/      \  $$/         | $$  $$$| $$| $$__  $$| $$  $$    | $$  | $$  $$$$| $$|_  $$
| $$\  $ | $$| $$  | $$| $$\  $$$| $$          | $$          | $$\  $ | $$| $$  | $$| $$\  $$   | $$  | $$\  $$$| $$  \ $$
| $$ \/  | $$|  $$$$$$/| $$ \  $$| $$$$$$$$    | $$          | $$ \/  | $$| $$  | $$| $$ \  $$ /$$$$$$| $$ \  $$|  $$$$$$/
|__/     |__/ \______/ |__/  \__/|________/    |__/          |__/     |__/|__/  |__/|__/  \__/|______/|__/  \__/ \______/



  /$$$$$$  /$$$$$$$  /$$$$$$$   /$$$$$$  /$$$$$$$  /$$$$$$$$ /$$   /$$ /$$   /$$ /$$$$$$ /$$$$$$$$ /$$     /$$
 /$$__  $$| $$__  $$| $$__  $$ /$$__  $$| $$__  $$|__  $$__/| $$  | $$| $$$ | $$|_  $$_/|__  $$__/|  $$   /$$/
| $$  \ $$| $$  \ $$| $$  \ $$| $$  \ $$| $$  \ $$   | $$   | $$  | $$| $$$$| $$  | $$     | $$    \  $$ /$$/
| $$  | $$| $$$$$$$/| $$$$$$$/| $$  | $$| $$$$$$$/   | $$   | $$  | $$| $$ $$ $$  | $$     | $$     \  $$$$/
| $$  | $$| $$____/ | $$____/ | $$  | $$| $$__  $$   | $$   | $$  | $$| $$  $$$$  | $$     | $$      \  $$/
| $$  | $$| $$      | $$      | $$  | $$| $$  \ $$   | $$   | $$  | $$| $$\  $$$  | $$     | $$       | $$
|  $$$$$$/| $$      | $$      |  $$$$$$/| $$  | $$   | $$   |  $$$$$$/| $$ \  $$ /$$$$$$   | $$       | $$
 \______/ |__/      |__/       \______/ |__/  |__/   |__/    \______/ |__/  \__/|______/   |__/       |__/


by steviep.eth
*/


import "./Dependencies.sol";

pragma solidity ^0.8.17;

interface ITokenURI {
  function tokenURI(uint256 tokenId) external view returns (string memory);
}

/// @title Money Making Opportunity
/// @author steviep.eth
/// @notice

contract MoneyMakingOpportunity is ERC721 {
  uint256 constant public FAIR_CONTRIBUTION = 0.03 ether;

  bool public isLocked = true;
  bool public uriLocked;
  uint256 public totalSupply;
  uint256 public beginning;
  uint256 public ending;
  uint256 public contributors;
  address public tokenURIContract;
  address public artist;

  mapping(address => uint256) public amountPaid;
  mapping(address => uint256) public addrToTokenId;
  mapping(uint256 => address) public settlementAddressProposals;
  mapping(uint256 => mapping(uint256 => bool)) private _tokenVotes;

  /// @dev This event emits when the metadata of a token is changed.
  /// So that the third-party platforms such as NFT market could
  /// timely update the images and related attributes of the NFT.
  event MetadataUpdate(uint256 _tokenId);

  /// @dev This event emits when the metadata of a range of tokens is changed.
  /// So that the third-party platforms such as NFT market could
  /// timely update the images and related attributes of the NFTs.
  event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

  constructor() ERC721('Money Making Opportunity', 'MMO') {
    artist = msg.sender;
    contributors++;
  }

  receive() external payable {
    uint256 originalAmount = amountPaid[msg.sender];
    amountPaid[msg.sender] += msg.value;

    if (
      isLocked
      && originalAmount < FAIR_CONTRIBUTION
      && amountPaid[msg.sender] >= FAIR_CONTRIBUTION
    ) {
      addrToTokenId[msg.sender] = contributors;
      contributors++;

    } else if (ending > 0) {
      payable(settlementAddressProposals[currentWeek()]).transfer(address(this).balance);
    }
  }

  function unlock(address _uriContract) external {
    require(msg.sender == artist, '11');
    require(isLocked, '1');
    isLocked = false;
    beginning = block.timestamp;
    tokenURIContract = _uriContract;
    totalSupply++;
    _mint(msg.sender, 0);
  }

  function claim() external {
    require(!isLocked, '2');

    totalSupply++;
    _mint(msg.sender, addrToTokenId[msg.sender]);
  }

  function castVote(uint256 tokenId, uint256 week, bool vote) external {
    require(ownerOf(tokenId) == msg.sender, '4');
    require(week >= currentWeek(), '5');
    require(ending == 0, '9');
    require(tokenIdToWeek(tokenId) > week, '12');

    _tokenVotes[tokenId][week] = vote;
  }


  function proposeSettlementAddress(uint256 week, address settlementAddress) external {
    uint256 tokenId = weekToTokenId(week);
    require(!isEliminated(tokenId), '6');
    require(ownerOf(tokenId) == msg.sender, '4');
    require(settlementAddressProposals[week] == address(0), '7');
    settlementAddressProposals[week] = settlementAddress;
    emit MetadataUpdate(tokenId);
  }


  function settlePayment() external {
    require(ending == 0, '8');
    uint256 week = currentWeek();
    if (week == contributors) require(ownerOf(0) == msg.sender);

    (uint256 yays, uint256 nays) = calculateVotes(week);

    require(yays >= nays, '10');

    ending = block.timestamp;
    payable(settlementAddressProposals[week]).transfer(address(this).balance);
    emit BatchMetadataUpdate(0, contributors);
  }

  function calculateVotes(uint256 week) public view returns (uint256, uint256) {
    uint256 yays = 1;
    uint256 nays;
    uint256 tokenId = weekToTokenId(week);

    for (uint256 i = 0; i < tokenId; i++) {
      if (_tokenVotes[i][week]) yays++;
      else nays++;
    }

    return (yays, nays);
  }

  function tokenIdToWeek(uint256 tokenId) public view returns (uint256) {
    return contributors - tokenId;
  }

  function weekToTokenId(uint256 week) public view returns (uint256) {
    if (isLocked) return 0;
    return contributors - week;
  }

  function currentWeek() public view returns (uint256) {
    if (isLocked) return 0;
    uint256 endTime = ending > 0 ? ending : block.timestamp;
    uint256 week = 1 + (endTime - beginning) / 1 weeks;

    return week >= contributors ? contributors : week;
  }

  function leaderToken() public view returns (uint256) {
    return weekToTokenId(currentWeek());
  }

  function isEliminated (uint256 tokenId) public view returns (bool) {
    return tokenId > leaderToken();
  }

  function votes(uint256 tokenId, uint256 week) public view returns (bool) {
    if (tokenIdToWeek(tokenId) == week) return true;
    return _tokenVotes[tokenId][week];
  }


  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
    return ITokenURI(tokenURIContract).tokenURI(tokenId);
  }

  function exists(uint256 tokenId) external view returns (bool) {
    return _exists(tokenId);
  }

  function setURIContract(address _uriContract) external {
    require(msg.sender == artist && !uriLocked, '11');
    tokenURIContract = _uriContract;
    emit BatchMetadataUpdate(0, contributors);
  }

  function commitURI() external {
    require(msg.sender == artist, '11');
    require(!isLocked, '13');
    uriLocked = true;
  }


  /// @notice Query if a contract implements an interface
  /// @param interfaceId The interface identifier, as specified in ERC-165
  /// @return `true` if the contract implements `interfaceId` and
  ///         `interfaceId` is not 0xffffffff, `false` otherwise
  /// @dev Interface identification is specified in ERC-165. This function
  ///      uses less than 30,000 gas. See: https://eips.ethereum.org/EIPS/eip-165
  ///      See EIP-4906: https://eips.ethereum.org/EIPS/eip-4906
  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721) returns (bool) {
    return interfaceId == bytes4(0x49064906) || super.supportsInterface(interfaceId);
  }
}
